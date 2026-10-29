"""격리 Docker 또는 일회성 CI에서만 합성 Secret과 실제 root 파일 권한을 검증한다."""
import base64
import contextlib
import importlib.util
import io
import json
import os
from pathlib import Path
import stat
import subprocess
import sys
import tempfile

if os.geteuid() != 0 or not (Path('/.dockerenv').exists() or os.environ.get('GITHUB_ACTIONS') == 'true'):
    raise RuntimeError('disposable root environment required')
spec = importlib.util.spec_from_file_location('token', Path(__file__).resolve().parents[2] / 'ops/oci/materialize-waveform-token.py')
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
sys.argv = ['fixture']
count = 0
with tempfile.TemporaryDirectory(dir='/root', prefix='waveform-token-') as temporary:
    root = Path(temporary)
    m.CONFIG, m.DIRECTORY, m.CLI = root / 'config', root / 'runtime', root / 'oci'
    m.DIRECTORY.mkdir(mode=0o700)
    payload = {'secretId': 'ocid1.vaultsecret.oc1.ap-osaka-1.fixture'}
    m.CONFIG.write_text(json.dumps(payload)); m.CONFIG.chmod(0o600)
    token = b'a' * 64
    original = b'b' * 64
    target = m.DIRECTORY / 'token'
    target.write_bytes(original); target.chmod(0o600)
    called = root / 'called'

    expected_args = ['secrets', 'secret-bundle', 'get', '--auth', 'instance_principal', '--region', 'ap-osaka-1',
                     '--secret-id', payload['secretId'], '--stage', 'CURRENT', '--query',
                     'data."secret-bundle-content".content', '--raw-output']

    def cli(output=base64.b64encode(token), status=0):
        m.CLI.write_text('#!/usr/bin/python3\nimport os,sys\nfrom pathlib import Path\n'
                        + f'Path({str(called)!r}).write_text("called")\n'
                        + 'assert "AWS_ACCESS_KEY_ID" not in os.environ and "OCI_CLI_CONFIG_FILE" not in os.environ\n'
                        + 'assert sys.argv[1:]=='+repr(expected_args)+'\n'
                        + f'sys.stdout.buffer.write({output!r});sys.stderr.write("private-diagnostic");sys.exit({status})\n')
        m.CLI.chmod(0o755)

    def check(ok, fetched):
        global count
        called.unlink(missing_ok=True)
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            status = m.main()
        assert status == (0 if ok else 1), (status, out.getvalue(), err.getvalue())
        assert called.exists() == fetched
        assert target.read_bytes() == (token if ok else original)
        assert not list(m.DIRECTORY.glob('.token-*'))
        assert out.getvalue() == ('{"event":"waveform_token_materialized"}\n' if ok else '')
        assert err.getvalue() == ('' if ok else '{"event":"waveform_token_materialization_failed"}\n')
        count += 1

    os.environ['AWS_ACCESS_KEY_ID'] = 'fixture-not-inherited'
    os.environ['OCI_CLI_CONFIG_FILE'] = '/fixture-not-inherited'
    previous_inode = target.stat().st_ino
    cli(); check(True, True)
    assert target.stat().st_ino != previous_inode
    target.unlink(); check(True, True)
    assert target.stat().st_uid == 0 and stat.S_IMODE(target.stat().st_mode) == 0o600
    target.write_bytes(original)
    for value in (b'invalid-base64', base64.b64encode(b'A' * 64), base64.b64encode(token + b'\n'), b'x' * 129):
        cli(value); check(False, True)
    cli(status=1); check(False, True)
    cli()
    for path in (m.CONFIG, m.DIRECTORY, m.CLI, root):
        before = path.stat()
        for change in ('owner', 'writable'):
            if change == 'owner': os.chown(path, 1002, 1002)
            else: path.chmod(stat.S_IMODE(before.st_mode) | 0o020)
            check(False, False)
            os.chown(path, before.st_uid, before.st_gid); path.chmod(stat.S_IMODE(before.st_mode))
    for path in (m.CONFIG, target):
        saved = root / 'saved'
        path.rename(saved); path.symlink_to(saved)
        check(False, False)
        path.unlink(); saved.rename(path)
        os.link(path, root / 'hardlink'); check(False, False); (root / 'hardlink').unlink()
    for path in (m.CONFIG, target):
        saved = root / 'saved'
        path.rename(saved); os.mkfifo(path, 0o600)
        # FIFO를 읽거나 기다리지 않고 거절하며 token 원본은 따로 보존한다.
        out, err = io.StringIO(), io.StringIO()
        called.unlink(missing_ok=True)
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            assert m.main() == 1
        assert not called.exists() and not out.getvalue()
        path.unlink(); saved.rename(path)
        count += 1
    m.CONFIG.write_bytes(b'x' * 1025); check(False, False)
    m.CONFIG.write_text(json.dumps(payload))
    for invalid in ({}, {**payload, 'extra': True}, {'secretId': 'not-a-secret'}, []):
        m.CONFIG.write_text(json.dumps(invalid)); check(False, False)
    m.CONFIG.write_text(json.dumps(payload))
    # 조회 timeout·교체 실패 시 직전 token을 보존하고 임시 파일을 지운다.
    original_run = m.subprocess.run
    def timeout(*args, **kwargs): raise subprocess.TimeoutExpired('fixture', 60)
    m.subprocess.run = timeout
    check(False, False)
    m.subprocess.run = original_run
    original_replace = m.os.replace
    def denied(*args): raise PermissionError('private-diagnostic')
    m.os.replace = denied
    check(False, True)
    m.os.replace = original_replace
print(json.dumps({'event': 'waveform_token_root_fixture_passed', 'cases': count}))
