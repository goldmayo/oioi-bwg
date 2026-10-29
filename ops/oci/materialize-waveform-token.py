#!/usr/bin/env python3
"""고정 Runner Secret 하나만 읽고 root 전용 runtime 파일에 원자적으로 공급한다."""
import base64
import json
import os
from pathlib import Path
import re
import stat
import subprocess
import sys
import tempfile

CONFIG = Path('/etc/oioibawige/waveform-runner-secret.json')
DIRECTORY = Path('/run/oioi-waveform-private')
CLI = Path('/usr/local/bin/oci')


def require(value):
    if not value:
        raise ValueError()


def directory(path):
    for entry in (*reversed(path.parents), path):
        info = entry.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022)


def protected(path, maximum):
    directory(path.parent)
    with os.fdopen(os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK), 'rb') as file:
        info = os.fstat(file.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1
                and stat.S_IMODE(info.st_mode) in (0o400, 0o600))
        value = file.read(maximum + 1)
        require(len(value) <= maximum)
        return value


def executable(path):
    directory(path.parent)
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1
            and not info.st_mode & 0o022 and info.st_mode & 0o100)


def materialize():
    require(os.geteuid() == 0)
    config = json.loads(protected(CONFIG, 1024))
    require(isinstance(config, dict) and set(config) == {'secretId'})
    secret = config['secretId']
    require(isinstance(secret, str) and re.fullmatch(r'ocid1\.vaultsecret\.oc1\.ap-osaka-1\.[a-z0-9]+', secret))
    directory(DIRECTORY)
    require(stat.S_IMODE(DIRECTORY.stat().st_mode) == 0o700)
    target = DIRECTORY / 'token'
    if target.exists() or target.is_symlink():
        protected(target, 65)
    executable(CLI)
    result = subprocess.run([str(CLI), 'secrets', 'secret-bundle', 'get', '--auth', 'instance_principal',
                             '--region', 'ap-osaka-1', '--secret-id', secret, '--stage', 'CURRENT',
                             '--query', 'data."secret-bundle-content".content', '--raw-output'],
                            env={'PATH': '/usr/local/bin:/usr/bin:/bin', 'HOME': str(DIRECTORY), 'LANG': 'C.UTF-8'},
                            stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, check=True, timeout=60)
    require(len(result.stdout) <= 128)
    token = base64.b64decode(result.stdout.strip(), validate=True)
    require(re.fullmatch(rb'[a-f0-9]{64}', token))
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=DIRECTORY, prefix='.token-', delete=False) as file:
            temporary = Path(file.name)
            os.fchmod(file.fileno(), 0o600)
            file.write(token)
            file.flush()
            os.fsync(file.fileno())
        os.replace(temporary, target)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)


def main():
    try:
        require(len(sys.argv) == 1)
        materialize()
        print('{"event":"waveform_token_materialized"}')
        return 0
    except (Exception, KeyboardInterrupt):
        print('{"event":"waveform_token_materialization_failed"}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
