#!/usr/bin/env python3
"""Same CI publisher/API credentials; fixed diagnostics and no deploy candidate."""
import datetime
import json
import os
import re
import subprocess
import tempfile
import time
import sys
from pathlib import Path


def require(value):
    if not value:
        raise ValueError()


def run(args, phase=None, **kwargs):
    if phase:
        print(json.dumps({'event': 'b0_publish_phase', 'phase': phase}), flush=True)
    try:
        return subprocess.run(args, capture_output=True, text=True, timeout=90, check=True, **kwargs).stdout
    except subprocess.SubprocessError as error:
        if phase:
            reason = 'timeout' if isinstance(error, subprocess.TimeoutExpired) else 'command_failed'
            if isinstance(error, subprocess.CalledProcessError) and re.search(r'\b(denied|unauthorized|401|403)\b', (error.stdout or '') + (error.stderr or ''), re.IGNORECASE):
                reason = 'permission_denied'
            if phase in ('web.push', 'console.push') and isinstance(error, subprocess.CalledProcessError):
                print(error.stdout or '', end='', flush=True)
                print(error.stderr or '', end='', file=sys.stderr, flush=True)
            print(json.dumps({'event': 'b0_publish_step_failed', 'phase': phase, 'reason': reason}), flush=True)
        raise


def identity():
    source = os.environ['SOURCE_SHA']
    run_id, attempt = os.environ['GITHUB_RUN_ID'], os.environ['GITHUB_RUN_ATTEMPT']
    require(re.fullmatch('[0-9a-f]{40}', source) and all(re.fullmatch('[1-9][0-9]*', value) for value in (run_id, attempt)))
    return {'sourceSha': source, 'runId': int(run_id), 'runAttempt': int(attempt)}


def publish():
    prefix = f"{os.environ['OCIR_REGISTRY']}/{os.environ['OCIR_NAMESPACE']}"
    require(re.fullmatch(r'(ap-osaka-1|kix)\.ocir\.io/[a-z0-9]+', prefix))
    marker = identity()
    images = {}
    with tempfile.TemporaryDirectory(prefix='p06-b0-') as directory:
        root = Path(directory)
        (root / 'marker').write_text(json.dumps(marker))
        (root / 'Dockerfile').write_text('FROM scratch\nENV PATH=/p06-b0-no-binaries\nCOPY marker /p06-b0-marker\n')
        tag = f"p06-b0-{marker['runId']}-{marker['runAttempt']}"
        tags = [f'{prefix}/{name}:{tag}' for name in ('oioi-bwg', 'oioi-bwg-console')]
        run(['docker', 'build', '--platform', 'linux/arm64', '-t', tags[0], '-t', tags[1], directory], phase='build')
        for app, reference in zip(('web', 'console'), tags):
            run(['docker', 'push', reference], phase=app + '.push')
            repository = reference.rsplit(':', 1)[0]
            digests = json.loads(run(['docker', 'image', 'inspect', '--format', '{{json .RepoDigests}}', reference], phase=app + '.digest'))
            matches = [value for value in digests if value.startswith(repository + '@sha256:')]
            require(len(matches) == 1 and re.fullmatch(re.escape(repository) + r'@sha256:[0-9a-f]{64}', matches[0]))
            images[app] = matches[0]
    Path('b0-proof.json').write_text(json.dumps({'marker': marker, 'images': images}) + '\n')


def command():
    with tempfile.TemporaryDirectory(prefix='p06-b0-api-') as directory:
        root = Path(directory)
        key = root / 'api-key.pem'
        key.touch(mode=0o600)
        key.write_text(os.environ['OCI_CLI_KEY_CONTENT'])
        env = {name: value for name, value in os.environ.items() if name != 'OCI_CLI_KEY_CONTENT'}
        env['OCI_CLI_KEY_FILE'] = str(key)
        base = ['oci', '--auth', 'api_key', '--config-file', '/dev/null', '--region', 'ap-osaka-1', '--max-retries', '0']
        instance = os.environ['OCI_COMPUTE_INSTANCE_OCID']
        compartment = os.environ['OCI_COMPUTE_COMPARTMENT_OCID']
        require(re.fullmatch(r'ocid1\.instance\.oc1\.ap-osaka-1\.[a-z0-9]+', instance))
        require(re.fullmatch(r'ocid1\.compartment\.oc1\.\.[a-z0-9]+', compartment))
        observed = json.loads(run(base + ['compute', 'instance', 'get', '--instance-id', instance], env=env))['data']
        require(observed['id'] == instance and observed['compartment-id'] == compartment)
        marker = identity()
        display_name = f"p06-b0-{marker['runId']}-{marker['runAttempt']}"
        content = {'source': {'sourceType': 'TEXT', 'text': 'sudo /srv/oioibawige/scripts/run-command-probe.sh'}, 'output': {'outputType': 'TEXT'}}
        command = json.loads(run(base + ['instance-agent', 'command', 'create', '--compartment-id', compartment, '--display-name', display_name, '--timeout-in-seconds', '120', '--target', json.dumps({'instanceId': instance}), '--content', json.dumps(content)], env=env))['data']['id']
        require(re.fullmatch(r'ocid1\.instanceagentcommand\.[a-z0-9.-]+', command))
        deadline = time.monotonic() + 360
        while time.monotonic() < deadline:
            try:
                execution = json.loads(run(base + ['instance-agent', 'command-execution', 'get', '--command-id', command, '--instance-id', instance], env=env))['data']
            except subprocess.CalledProcessError as error:
                require('NotAuthorizedOrNotFound' in ((error.stdout or '') + (error.stderr or '')))
                time.sleep(10)
                continue
            require(execution['instance-id'] == instance and execution['instance-agent-command-id'] == command)
            state = execution['lifecycle-state']
            if state == 'SUCCEEDED':
                require(type(execution['content']['exit-code']) is int and execution['content']['exit-code'] == 0)
                created = datetime.datetime.fromisoformat(execution['time-created'].replace('Z', '+00:00')).isoformat()
                require(datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(minutes=10) <= datetime.datetime.fromisoformat(created) <= datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(minutes=1))
                Path('b0-command-proof.json').write_text(json.dumps({'sourceSha': marker['sourceSha'], 'displayName': display_name, 'createdAt': created, 'state': state, 'exitCode': 0}) + '\n')
                return
            require(state in ('ACCEPTED', 'IN_PROGRESS'))
            time.sleep(10)
        raise ValueError()


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 2 and sys.argv[1] in ('publish', 'command'))
        (publish if sys.argv[1] == 'publish' else command)()
        print('{"event":"b0_ci_probe_passed"}')
    except (KeyError, ValueError, TypeError, OSError, subprocess.SubprocessError):
        print('{"event":"b0_ci_probe_failed"}')
        raise SystemExit(1)
