"""Run only on a disposable CI runner; all installation targets are temporary."""
import os
from pathlib import Path
import stat
import subprocess
import tempfile

assert os.geteuid() == 0 and os.environ.get('GITHUB_ACTIONS') == 'true'
repository = Path.cwd()
with tempfile.TemporaryDirectory(prefix='oioi-host-path-', dir='/root') as temporary:
    base = Path(temporary)
    runtime, config, bin_dir = (base / name for name in ('runtime', 'config', 'bin'))
    for path in (runtime / 'scripts', runtime / 'deploy', config, bin_dir, base / 'sudoers', base / 'systemd'):
        path.mkdir(parents=True, exist_ok=True)
    for name in ('visudo', 'systemctl', 'docker', 'oci'):
        path = bin_dir / name
        path.write_text('#!/bin/sh\nprintf "%s\\n" "$0" >> "$HOST_TEST_ROOT/calls"\n')
        path.chmod(0o755)
    source = (repository / 'ops/oci/install-host-assets.sh').read_text()
    source = source.replace('repository_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"',
                            'repository_root="${HOST_TEST_REPOSITORY}"')
    for old, new in (('/srv/oioibawige', str(runtime)), ('/etc/oioibawige', str(config)),
                     ('/etc/sudoers.d', str(base / 'sudoers')), ('/etc/systemd/system', str(base / 'systemd'))):
        source = source.replace(old, new)
    assert '/srv/' not in source and '/etc/' not in source
    installer = base / 'installer.sh'
    installer.write_text(source)
    environment = dict(os.environ, PATH=str(bin_dir) + ':/usr/bin:/bin', HOST_TEST_ROOT=str(base),
                       HOST_TEST_REPOSITORY=str(repository), OIOI_RUNTIME_ROOT=str(runtime), OIOI_CONFIG_ROOT=str(config))

    def execute(script, *args):
        return subprocess.run(['bash', str(script), *args], env=environment, capture_output=True, timeout=15)

    installed = execute(installer)
    assert installed.returncode == 0, installed.stderr
    helper = runtime / 'scripts/paired-release.py'
    assert helper.read_bytes() == (repository / 'ops/oci/paired-release.py').read_bytes()
    assert helper.stat().st_uid == 0 and stat.S_IMODE(helper.stat().st_mode) == 0o755
    for path in (runtime, runtime / 'scripts', runtime / 'deploy', config):
        assert path.stat().st_uid == 0 and not path.stat().st_mode & 0o022
    protected = {path: path.read_bytes() for path in (helper, config / 'deploy.conf', runtime / 'deploy/deployment.lock')}
    (base / 'calls').unlink()
    for path in (base, runtime, runtime / 'scripts', runtime / 'deploy', config):
        for unsafe in ('owner', 'writable'):
            before = path.stat()
            if unsafe == 'owner': os.chown(path, 1002, 1002)
            else: path.chmod(0o777)
            try:
                for script in (installer, repository / 'ops/oci/preflight-host.sh'):
                    result = execute(script)
                    assert result.returncode == 1 and b'path is not root-protected' in result.stderr, result.stderr
                assert path.stat().st_uid == (1002 if unsafe == 'owner' else 0)
                assert stat.S_IMODE(path.stat().st_mode) == (0o777 if unsafe == 'writable' else stat.S_IMODE(before.st_mode))
                assert all(file.read_bytes() == value for file, value in protected.items())
                assert not (base / 'calls').exists()
            finally:
                os.chown(path, before.st_uid, before.st_gid)
                path.chmod(stat.S_IMODE(before.st_mode))
    scripts = runtime / 'scripts'
    saved = runtime / 'saved-scripts'
    scripts.rename(saved)
    scripts.symlink_to(saved, target_is_directory=True)
    try:
        for script in (installer, repository / 'ops/oci/preflight-host.sh'):
            result = execute(script)
            assert result.returncode == 1 and b'path is not root-protected' in result.stderr, result.stderr
        assert not (base / 'calls').exists()
    finally:
        scripts.unlink()
        saved.rename(scripts)
    legacy = {runtime / 'compose.oci-development.yml': b'services:\n  app:\n    image: legacy\n',
              scripts / 'deploy-release.sh': b'#!/bin/sh\nexit 0\n', config / 'deploy.conf': b'preserved configuration\n'}
    for path, content in legacy.items(): path.write_bytes(content)
    assert execute(installer).returncode == 1
    upgraded = execute(installer, '--upgrade-paired')
    assert upgraded.returncode == 0, upgraded.stderr
    for path, content in legacy.items():
        name = 'compose.yml' if path.name == 'compose.oci-development.yml' else path.name
        backup = runtime / 'deploy/legacy-host' / name
        assert backup.read_bytes() == content
        assert backup.stat().st_uid == 0 and stat.S_IMODE(backup.stat().st_mode) == 0o600
    assert (config / 'deploy.conf').read_bytes() == legacy[config / 'deploy.conf']
    assert helper.read_bytes() == (repository / 'ops/oci/paired-release.py').read_bytes()
print('host_root_paths_and_paired_upgrade_passed')
