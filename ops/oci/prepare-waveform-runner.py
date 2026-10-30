#!/usr/bin/env python3
"""서비스 시작 전 전용 runtime 경로와 고정 egress를 준비한다."""
import grp
import json
import os
import pwd
from pathlib import Path
import runpy
import stat
import subprocess
import sys

ASSETS = Path('/usr/local/lib/oioi-waveform-runner')
CONFIG = Path('/etc/oioibawige/waveform-runner.json')
SOCKET = Path('/run/oioi-waveform')
PRIVATE = Path('/run/oioi-waveform-private')
METADATA = Path('/usr/local/lib/oioi-metadata-guard/metadata-guard.py')
GROUP = 'oioi-waveform-console'
ENV = {'PATH': '/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin', 'LANG': 'C.UTF-8'}


def prepare():
    if os.geteuid() != 0:
        raise ValueError()
    helper = runpy.run_path(str(ASSETS / 'materialize-waveform-token.py'))
    value = json.loads(helper['protected'](CONFIG, 4096))
    group = grp.getgrnam(GROUP)
    if type(value.get('socketGroup')) is not int or value['socketGroup'] != group.gr_gid or group.gr_gid <= 0 or group.gr_mem or any(user.pw_gid == group.gr_gid for user in pwd.getpwall()):
        raise ValueError()
    for path, mode, gid in ((SOCKET, 0o750, group.gr_gid), (PRIVATE, 0o700, 0)):
        helper['directory'](path.parent)
        if not path.exists() and not path.is_symlink():
            path.mkdir(mode=0o700)
            os.chown(path, 0, gid)
            path.chmod(mode)
        info = path.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != 0 or info.st_gid != gid or stat.S_IMODE(info.st_mode) != mode:
            raise ValueError()
    def command(args):
        return subprocess.run(args, env=ENV, capture_output=True, text=True, check=True, timeout=15).stdout
    helper['executable'](METADATA)
    command(['/usr/bin/python3', '-I', str(METADATA), 'check'])
    command(['/usr/bin/python3', '-I', str(ASSETS / 'waveform-egress-guard.py'), 'apply'])
    docker = ['docker', '--host=unix:///var/run/docker.sock', 'network']
    # inspect 장애를 부재로 간주하지 않는다. 정확한 이름 목록에서 부재인 경우에만 생성한다.
    names = command([*docker, 'ls', '--format', '{{.Name}}']).splitlines()
    if 'oioi-waveform-egress' not in names:
        command([*docker, 'create', '--driver', 'bridge', '--label', 'com.oioi.waveform.network=1',
                 '--opt', 'com.docker.network.bridge.name=oioi-wf0',
                 '--opt', 'com.docker.network.bridge.enable_icc=false', 'oioi-waveform-egress'])
    command(['/usr/bin/python3', '-I', str(ASSETS / 'waveform-egress-guard.py'), 'check'])


def main():
    try:
        if len(sys.argv) != 1:
            raise ValueError()
        prepare()
        print('{"event":"waveform_runner_prepared"}')
        return 0
    except Exception:
        print('{"event":"waveform_runner_prepare_failed"}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
