#!/usr/bin/env python3
"""root 보호 staging의 검증 바이너리/host asset을 설치한다. 서비스는 시작하지 않는다."""
import fcntl
import contextlib
import grp
import hashlib
import os
from pathlib import Path
import re
import pwd
import stat
import subprocess
import sys
import tempfile

SOURCE = Path(__file__).resolve().parent
DESTINATION = Path('/usr/local/lib/oioi-waveform-runner')
UNIT = Path('/etc/systemd/system/oioi-waveform-runner.service')
LOCK = Path('/run/oioi-waveform-install.lock')
HOST_LOCK = Path('/run/oioi-waveform/runner.lock')
GROUP = 'oioi-waveform-console'
ENV = {'PATH': '/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C.UTF-8'}


def require(value):
    if not value:
        raise ValueError()


def directory(path):
    for entry in (*reversed(path.parents), path):
        try:
            info = entry.lstat()
        except FileNotFoundError:
            continue
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022)


def regular(path):
    directory(path.parent)
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1 and not info.st_mode & 0o022)


def command(args):
    return subprocess.run(args, env=ENV, capture_output=True, text=True, check=True, timeout=15).stdout.strip()


def install(binary, checksum):
    require(os.geteuid() == 0 and re.fullmatch('[a-f0-9]{64}', checksum))
    regular(binary)
    require(binary.stat().st_size <= 64 * 1024 * 1024)
    data = binary.read_bytes()
    require(hashlib.sha256(data).hexdigest() == checksum and data[:6] == b'\x7fELF\x02\x01'
            and data[18:20] == b'\xb7\x00')
    assets = {DESTINATION / 'runner': (data, 0o755)}
    for name in ('prepare-waveform-runner.py', 'materialize-waveform-token.py', 'waveform-egress-guard.py'):
        source = SOURCE / name
        regular(source)
        assets[DESTINATION / name] = (source.read_bytes(), 0o644)
    source = SOURCE / 'waveform/oioi-waveform-runner.service'
    regular(source)
    assets[UNIT] = (source.read_bytes(), 0o644)
    for path in (*assets, LOCK, HOST_LOCK):
        directory(path.parent)
        if path.exists() or path.is_symlink():
            regular(path)
    # 같은 host의 설치를 직렬화하고 실행 중이거나 전환 중인 서비스를 덮어쓰지 않는다.
    with contextlib.ExitStack() as stack, os.fdopen(os.open(LOCK, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600), 'r+b') as lock:
        info = os.fstat(lock.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and info.st_nlink == 1 and stat.S_IMODE(info.st_mode) == 0o600)
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        if HOST_LOCK.parent.exists():
            host_lock = stack.enter_context(os.fdopen(os.open(HOST_LOCK, os.O_CREAT | os.O_RDWR | os.O_NOFOLLOW | os.O_NONBLOCK, 0o600), 'r+b'))
            regular(HOST_LOCK)
            require(stat.S_IMODE(os.fstat(host_lock.fileno()).st_mode) == 0o600)
            fcntl.flock(host_lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        state = command(['systemctl', 'show', 'oioi-waveform-runner.service', '--property=ActiveState', '--value'])
        require(state in ('inactive', 'failed'))
        require(command(['systemctl', 'show', 'oioi-waveform-runner.service', '--property=UnitFileState', '--value']) in ('', 'disabled'))
        try:
            group = grp.getgrnam(GROUP)
            require(group.gr_gid > 0 and not group.gr_mem)
        except KeyError:
            command(['groupadd', '--system', GROUP])
            group = grp.getgrnam(GROUP)
        require(group.gr_gid > 0 and not group.gr_mem and not any(user.pw_gid == group.gr_gid for user in pwd.getpwall()))
        # 기존 비보호 경로는 고치지 않는다. 파일은 같은 디렉터리에서 원자 교체한다.
        for path, (content, mode) in assets.items():
            path.parent.mkdir(mode=0o755, parents=True, exist_ok=True)
            temporary = None
            try:
                with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.waveform-', delete=False) as file:
                    temporary = Path(file.name)
                    os.fchmod(file.fileno(), mode)
                    file.write(content)
                    file.flush()
                    os.fsync(file.fileno())
                os.replace(temporary, path)
            finally:
                if temporary is not None:
                    temporary.unlink(missing_ok=True)
        command(['systemctl', 'daemon-reload'])


def main():
    try:
        require(len(sys.argv) == 4 and sys.argv[1] == '--install')
        install(Path(sys.argv[2]), sys.argv[3])
        print('{"event":"waveform_runner_assets_installed","started":false}')
        return 0
    except Exception:
        print('{"event":"waveform_runner_install_failed"}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
