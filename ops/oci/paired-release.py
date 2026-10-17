#!/usr/bin/env python3
"""Locked paired apply/rollback. Compose reconciles each service independently."""
import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile

APPS = ('web', 'console')
SHA = r'[0-9a-f]{40}'
DIGEST = r'sha256:[0-9a-f]{64}'
CONFIG_KEYS = ('IMAGE_REPOSITORY', 'CONSOLE_IMAGE_REPOSITORY', 'POSTGRES_NETWORK',
               'APP_BIND_ADDRESS', 'APP_PORT', 'CONSOLE_PORT', 'SMOKE_PATHS', 'CONSOLE_SMOKE_PATHS')


def require(value):
    if not value:
        raise ValueError('Invalid paired deployment')


def identity(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()


def run(args, env=None):
    return subprocess.run(args, env=env, capture_output=True, check=True, timeout=240).stdout.decode().strip()


def atomic(path, data):
    fd, name = tempfile.mkstemp(dir=path.parent, prefix='.release-')
    try:
        with os.fdopen(fd, 'wb') as output:
            output.write(data)
            output.flush()
            os.fsync(output.fileno())
        os.replace(name, path)
    finally:
        Path(name).unlink(missing_ok=True)


def link(path, target):
    temporary = path.with_name('.' + path.name + '.next')
    temporary.unlink(missing_ok=True)
    temporary.symlink_to(target)
    os.replace(temporary, path)


def validate(candidate, digests, config):
    require(set(candidate) == {'prNumber', 'sourceSha', 'sourceTree', 'runId', 'runAttempt', 'baseline', 'buildConfigHash', 'images'})
    require(all(re.fullmatch(SHA, candidate[key]) for key in ('sourceSha', 'sourceTree')))
    require(all(type(candidate[key]) is int and 0 < candidate[key] <= 9007199254740991 for key in ('prNumber', 'runId', 'runAttempt')))
    require(re.fullmatch(r'[0-9a-f]{64}', candidate['buildConfigHash']) and set(candidate['images']) == set(APPS))
    baseline = candidate['baseline']
    if baseline is not None:
        require(set(baseline) == {'releaseId', 'artifactId', 'runId', 'runAttempt'})
        require(re.fullmatch(r'[0-9a-f]{64}', baseline['releaseId']))
        require(all(type(baseline[key]) is int and 0 < baseline[key] <= 9007199254740991 for key in ('artifactId', 'runId', 'runAttempt')))
    for app, digest in zip(APPS, digests):
        image = candidate['images'][app]
        require(set(image) == {'repository', 'digest', 'buildSourceSha', 'origin'})
        require(re.fullmatch(r'[a-z0-9.-]+(?:/[a-z0-9._-]+)+', image['repository']))
        require(re.fullmatch(DIGEST, digest) and image['digest'] == digest)
        require(image['repository'] == config['IMAGE_REPOSITORY' if app == 'web' else 'CONSOLE_IMAGE_REPOSITORY'])
        require(re.fullmatch(SHA, image['buildSourceSha']) and image['origin'] in {'built', 'reused'})
        require((image['origin'] == 'built' and image['buildSourceSha'] == candidate['sourceSha']) or (image['origin'] == 'reused' and baseline is not None))
    require(candidate['images']['web']['repository'] != candidate['images']['console']['repository'])


def compose_env(candidate, config, runtime, env_root=None):
    environment = dict(os.environ)
    environment.update(config)
    for app in APPS:
        image = candidate['images'][app]
        environment[app.upper() + '_IMAGE'] = image['repository'] + '@' + image['digest']
        environment[app.upper() + '_ENV_FILE'] = str((env_root or runtime) / (app + '.env'))
    return environment


def compose(file, environment, *args):
    return run(['docker', 'compose', '-p', 'oioi-bwg-development', '-f', str(file), *args], environment)


def smoke(config, apps=APPS):
    for app in apps:
        port = config['APP_PORT' if app == 'web' else 'CONSOLE_PORT']
        paths = ['/healthz', '/readyz'] + config['SMOKE_PATHS' if app == 'web' else 'CONSOLE_SMOKE_PATHS'].split()
        for path in paths:
            require(path.startswith('/') and not any(c in path for c in '\r\n\x00'))
            run(['curl', '--fail', '--silent', '--max-time', '15', 'http://127.0.0.1:' + port + path])


def containers(file, environment, candidate):
    result = {}
    for app in APPS:
        container = compose(file, environment, 'ps', '-q', app)
        require(container and re.fullmatch(r'[0-9a-f]{12,64}', container))
        item = json.loads(run(['docker', 'inspect', container]))[0]
        image = candidate['images'][app]
        require(item['Config']['Image'] == image['repository'] + '@' + image['digest'])
        require(item['State']['Running'] and item['State']['Health']['Status'] == 'healthy')
        result[app] = {'image': item['Config']['Image'], 'configHash': item['Config']['Labels']['com.docker.compose.config-hash']}
    return result


def legacy_environment(legacy, runtime, digest):
    # Both files were explicitly snapshotted by the root-only installer before upgrade.
    script = 'set -a; source "$1"; python3 -c \'import json,os; print(json.dumps(dict(os.environ)))\''
    environment = json.loads(run(['bash', '-c', script, 'legacy-config', str(legacy / 'deploy.conf')]))
    require(re.fullmatch(DIGEST, digest))
    environment.update(APP_IMAGE=environment['IMAGE_REPOSITORY'] + '@' + digest,
                       APP_ENV_FILE=str(runtime / 'app.env'))
    return environment


def deploy(digests, encoded):
    runtime = Path(os.environ.get('OIOI_RUNTIME_ROOT', '/srv/oioibawige'))
    state = Path(os.environ.get('OIOI_STATE_DIR', str(runtime / 'deploy')))
    config_root = Path(os.environ.get('OIOI_CONFIG_ROOT', '/etc/oioibawige'))
    file = Path(os.environ.get('OIOI_COMPOSE_FILE', str(runtime / 'compose.oci-development.yml')))
    config = {key: os.environ[key] for key in CONFIG_KEYS}
    require(config['APP_BIND_ADDRESS'] == '127.0.0.1')
    require(all(re.fullmatch(r'[0-9]{1,5}', config[key]) and 0 < int(config[key]) <= 65535 for key in ('APP_PORT', 'CONSOLE_PORT')))
    require(config['APP_PORT'] != config['CONSOLE_PORT'])
    # Validate even smoke configuration before stopping the old app.
    require(all(path.startswith('/') for key in ('SMOKE_PATHS', 'CONSOLE_SMOKE_PATHS') for path in config[key].split()))
    require(re.fullmatch(r'[A-Za-z0-9_-]{1,16000}', encoded))
    candidate = json.loads(base64.urlsafe_b64decode(encoded + '=' * (-len(encoded) % 4)))
    validate(candidate, digests, config)
    current = state / 'current-pair'
    previous = state / 'previous-pair'
    pending = state / 'pending-pair'
    previous_before = previous.resolve(strict=True) if previous.is_symlink() else None
    require(not pending.exists())
    old = current.resolve(strict=True) if current.is_symlink() else None
    require(old is not None or not current.exists())
    baseline = candidate['baseline']
    require((old is None and baseline is None) or (old is not None and baseline is not None))
    if old:
        old_candidate = json.loads((old / 'candidate.json').read_text())
        require(identity(old_candidate) == baseline['releaseId'])
        old_config = json.loads((old / 'config.json').read_text())
        old_environment = compose_env(old_candidate, old_config, runtime)
        for app in APPS:
            require((runtime / (app + '.env')).read_bytes() == (old / (app + '.env')).read_bytes())
            if candidate['images'][app]['origin'] == 'reused':
                require(all(candidate['images'][app][key] == old_candidate['images'][app][key] for key in ('repository', 'digest', 'buildSourceSha')))
        require(containers(file, old_environment, old_candidate) == json.loads((old / 'containers.json').read_text()))
    legacy = state / 'legacy-host'
    legacy_digest = (state / 'current').read_text().strip() if old is None and (state / 'current').exists() else None
    if legacy_digest:
        require(all((legacy / name).is_file() for name in ('compose.yml', 'deploy.conf', 'deploy-release.sh')))
        require((runtime / 'app.env').is_file())
        legacy_env = legacy_environment(legacy, runtime, legacy_digest)
        container = compose(legacy / 'compose.yml', legacy_env, 'ps', '-q', 'app')
        require(re.fullmatch(r'[0-9a-f]{12,64}', container))
        legacy_info = json.loads(run(['docker', 'inspect', container]))[0]
        require(legacy_info['Config']['Image'] == legacy_env['APP_IMAGE'] and legacy_info['State']['Running'] and legacy_info['State']['Health']['Status'] == 'healthy')
    snapshot = Path(tempfile.mkdtemp(prefix=identity(candidate) + '-', dir=state))
    committed = False
    try:
        spec = importlib.util.spec_from_file_location('runtime_env', Path(__file__).with_name('materialize-runtime-env.py'))
        materializer = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(materializer)
        web_required = os.environ.get('REQUIRED_RUNTIME_KEYS', 'DATABASE_URL AUTH_SECRET')
        for app in APPS:
            os.environ['REQUIRED_RUNTIME_KEYS'] = web_required if app == 'web' else 'DATABASE_URL CONSOLE_AUTH_SECRET CONSOLE_MFA_ENCRYPTION_KEY'
            public = config_root / ('runtime-public.env' if app == 'web' else 'console-runtime-public.env')
            mapping = config_root / ('runtime-secrets.env' if app == 'web' else 'console-runtime-secrets.env')
            materializer.materialize(app, public, mapping, snapshot / (app + '.env'))
        web = materializer.read_env(snapshot / 'web.env')
        console = materializer.read_env(snapshot / 'console.env')
        require(web['AUTH_SECRET'] not in {console['CONSOLE_AUTH_SECRET'], console['CONSOLE_MFA_ENCRYPTION_KEY']})
        require(web['DATABASE_URL'] == console['DATABASE_URL'])
        for app in APPS:
            image = candidate['images'][app]
            reference = image['repository'] + '@' + image['digest']
            run(['docker', 'pull', reference])
            info = json.loads(run(['docker', 'image', 'inspect', reference]))[0]
            require(info['Architecture'] == 'arm64' and info['Config']['Labels']['org.opencontainers.image.revision'] == image['buildSourceSha'])
        compose(file, compose_env(candidate, config, runtime, snapshot), 'config', '--quiet')
        (snapshot / 'candidate.json').write_text(json.dumps(candidate))
        (snapshot / 'config.json').write_text(json.dumps(config))
        shutil.copyfile(file, snapshot / 'compose.yml')
        atomic(pending, identity(candidate).encode())
        try:
            for app in APPS:
                atomic(runtime / (app + '.env'), (snapshot / (app + '.env')).read_bytes())
            if legacy_digest:
                compose(legacy / 'compose.yml', legacy_env, 'stop', 'app')
            environment = compose_env(candidate, config, runtime)
            compose(file, environment, 'up', '-d', '--wait', 'web', 'console')
            smoke(config)
            (snapshot / 'containers.json').write_text(json.dumps(containers(file, environment, candidate)))
            if legacy_digest:
                compose(legacy / 'compose.yml', legacy_env, 'rm', '-f', 'app')
            if old:
                link(previous, old)
            link(current, snapshot)
            committed = True
            try:
                pending.unlink()
            except OSError:
                print('paired_pending_cleanup_required', file=sys.stderr)
            print('paired_deployment_succeeded')
            return 0
        except Exception:
            print('paired_candidate_failed', file=sys.stderr)
            try:
                if old:
                    for app in APPS:
                        atomic(runtime / (app + '.env'), (old / (app + '.env')).read_bytes())
                    atomic(file, (old / 'compose.yml').read_bytes())
                    compose(file, old_environment, 'up', '-d', '--wait', 'web', 'console')
                    smoke(old_config)
                    require(containers(file, old_environment, old_candidate) == json.loads((old / 'containers.json').read_text()))
                elif legacy_digest:
                    compose(file, compose_env(candidate, config, runtime), 'stop', 'web', 'console')
                    compose(legacy / 'compose.yml', legacy_env, 'up', '-d', '--wait', 'app')
                    smoke({'APP_PORT': legacy_env['APP_PORT'], 'SMOKE_PATHS': legacy_env['SMOKE_PATHS']}, ('web',))
                else:
                    compose(file, compose_env(candidate, config, runtime), 'stop', 'web', 'console')
                    raise ValueError('No previous release')
                if old:
                    if previous_before:
                        link(previous, previous_before)
                    else:
                        previous.unlink(missing_ok=True)
                pending.unlink()
                print('paired_rollback_succeeded', file=sys.stderr)
                return 20
            except Exception:
                print('paired_rollback_failed', file=sys.stderr)
                return 21
    finally:
        if not committed:
            # Keep crash/failed-rollback evidence and both protected snapshots.
            if not pending.exists():
                shutil.rmtree(snapshot)


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 4)
        sys.exit(deploy(sys.argv[1:3], sys.argv[3]))
    except Exception:
        print('paired_preflight_failed', file=sys.stderr)
        sys.exit(1)
