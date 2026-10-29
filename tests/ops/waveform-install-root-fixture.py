"""일회성 root 환경에서 설치 파일 권한과 시작 전 실패 경계를 검증한다. 실제 OCI/Docker/systemd 기동 없음."""
import contextlib
import fcntl
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import shutil
import stat
import subprocess
import sys
import tempfile
from types import SimpleNamespace

if os.geteuid() != 0 or not (Path('/.dockerenv').exists() or os.environ.get('GITHUB_ACTIONS') == 'true'):
    raise RuntimeError('disposable root environment required')
REPO = Path(__file__).resolve().parents[2]

def module(name):
    spec = importlib.util.spec_from_file_location(name, REPO / 'ops/oci' / (name + '.py'))
    value = importlib.util.module_from_spec(spec); spec.loader.exec_module(value)
    return value

m = module('install-waveform-runner')
p = module('prepare-waveform-runner')
cases = 0
with tempfile.TemporaryDirectory(dir='/root', prefix='waveform-install-') as temporary:
    root = Path(temporary)
    m.SOURCE, m.DESTINATION = root / 'source', root / 'installed'
    m.UNIT, m.LOCK, m.HOST_LOCK = root / 'units/runner.service', root / 'install.lock', root / 'runtime/runner.lock'
    m.SOURCE.mkdir(); (m.SOURCE / 'waveform').mkdir()
    for name in ('prepare-waveform-runner.py', 'materialize-waveform-token.py', 'waveform-egress-guard.py', 'waveform/oioi-waveform-runner.service'):
        shutil.copyfile(REPO / 'ops/oci' / name, m.SOURCE / name)
    binary = root / 'runner'; binary.write_bytes(b'\x7fELF\x02\x01' + b'\0' * 12 + b'\xb7\0' + b'fixture')
    checksum = hashlib.sha256(binary.read_bytes()).hexdigest()
    calls = []
    state = 'inactive'
    enabled = ''
    def command(args):
        calls.append(args)
        return state if '--property=ActiveState' in args else enabled if '--property=UnitFileState' in args else ''
    m.command = command
    m.grp.getgrnam = lambda name: SimpleNamespace(gr_gid=54321, gr_mem=[])
    m.pwd.getpwall = lambda: []
    def install(ok):
        global cases
        calls.clear()
        sys.argv = ['install', '--install', str(binary), checksum]
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            assert m.main() == (0 if ok else 1)
        assert 'private' not in out.getvalue() + err.getvalue()
        assert all('start' not in call and 'enable' not in call and 'restart' not in call for call in calls)
        assert not list(root.rglob('.waveform-*'))
        cases += 1
    install(True); install(True)
    assert (m.DESTINATION / 'runner').read_bytes() == binary.read_bytes()
    assert stat.S_IMODE((m.DESTINATION / 'runner').stat().st_mode) == 0o755
    original = {path: path.read_bytes() for path in m.DESTINATION.iterdir()}
    m.grp.getgrnam = lambda name: SimpleNamespace(gr_gid=54321, gr_mem=['fixture-user'])
    install(False)
    m.grp.getgrnam = lambda name: SimpleNamespace(gr_gid=54321, gr_mem=[])
    m.pwd.getpwall = lambda: [SimpleNamespace(pw_gid=54321)]
    install(False)
    m.pwd.getpwall = lambda: []
    for value in ('active', 'activating', 'deactivating'):
        state = value; install(False)
    state = 'inactive'; enabled = 'enabled'; install(False); enabled = ''
    previous = checksum; checksum = 'a' * 64; install(False); checksum = previous
    for path in (m.DESTINATION, m.SOURCE, binary, m.UNIT):
        before = path.stat()
        for change in ('owner', 'writable'):
            if change == 'owner': os.chown(path, 1002, 1002)
            else: path.chmod(stat.S_IMODE(before.st_mode) | 0o020)
            install(False)
            os.chown(path, before.st_uid, before.st_gid); path.chmod(stat.S_IMODE(before.st_mode))
    target = m.DESTINATION / 'runner'; saved = root / 'saved'
    target.rename(saved); target.symlink_to(saved); install(False); target.unlink(); saved.rename(target)
    os.link(target, root / 'link'); install(False); (root / 'link').unlink()
    m.HOST_LOCK.parent.mkdir()
    for lock in (m.LOCK, m.HOST_LOCK):
        with open(lock, 'a+b') as file:
            lock.chmod(0o600); fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB); install(False)
    assert all(path.read_bytes() == data for path, data in original.items())
    # 실제 systemd parser로 명령 순서/문법 검증. dependency는 일회성 mock unit이고 기동하지 않는다.
    unit = (REPO / 'ops/oci/waveform/oioi-waveform-runner.service').read_text()
    pre = [line for line in unit.splitlines() if line.startswith('ExecStartPre=')]
    assert len(pre) == 3 and 'prepare-waveform-runner.py' in pre[0] and pre[1].endswith('runner cleanup') and 'materialize-waveform-token.py' in pre[2]
    assert 'ExecStopPost=/usr/local/lib/oioi-waveform-runner/runner cleanup' in unit
    units = m.UNIT.parent
    for name in ('docker', 'oioi-metadata-guard'):
        (units / (name + '.service')).write_text('[Service]\nType=oneshot\nExecStart=/usr/bin/true\n')
    m.UNIT.write_text(unit.replace('/usr/local/lib/oioi-waveform-runner', str(m.DESTINATION)))
    subprocess.run(['systemd-analyze', 'verify', '--man=no', str(m.UNIT)],
                   env={**os.environ, 'SYSTEMD_UNIT_PATH': str(units) + ':/usr/lib/systemd/system'}, check=True, timeout=15, capture_output=True)
    p.ASSETS, p.CONFIG, p.SOCKET, p.PRIVATE = m.DESTINATION, root / 'config', root / 'socket', root / 'private'
    p.METADATA = root / 'metadata.py'; p.METADATA.write_text('fixture'); p.METADATA.chmod(0o755)
    p.CONFIG.write_text(json.dumps({'socketGroup': 54321})); p.CONFIG.chmod(0o600)
    actions = []; fail = ''; exists = False
    real_run = subprocess.run
    def mock(args, **kwargs):
        actions.append(args)
        if (fail and fail in args) or (fail == 'egress-check' and args[-1] == 'check' and 'waveform-egress-guard.py' in args[-2]): raise subprocess.CalledProcessError(1, args, stderr='private')
        return SimpleNamespace(stdout='oioi-waveform-egress\n' if exists and 'ls' in args else '')
    p.subprocess.run = mock
    def prepare(ok):
        global cases
        actions.clear(); sys.argv = ['prepare']
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
            assert p.main() == (0 if ok else 1)
        cases += 1
    prepare(True)
    assert [call[-1] for call in actions] == ['check', 'apply', '{{.Name}}', 'oioi-waveform-egress', 'check']
    assert stat.S_IMODE(p.SOCKET.stat().st_mode) == 0o750 and p.SOCKET.stat().st_gid == 54321
    assert stat.S_IMODE(p.PRIVATE.stat().st_mode) == 0o700
    exists = True; prepare(True); assert not any('create' in call for call in actions)
    for failure in ('check', 'apply', 'ls', 'egress-check'):
        fail = failure; prepare(False); assert not any('create' in call for call in actions)
    fail = ''; p.SOCKET.chmod(0o777); prepare(False); assert not actions; p.SOCKET.chmod(0o750)
    p.CONFIG.write_text(json.dumps({'socketGroup': 0})); prepare(False); assert not actions
    p.subprocess.run = real_run
print(json.dumps({'event': 'waveform_install_root_fixture_passed', 'cases': cases}))
