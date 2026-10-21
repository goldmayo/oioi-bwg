#!/usr/bin/env python3
"""Approved host-only MFA operations; never install or run via the deployment principal."""
import argparse
import datetime
import fcntl
import hashlib
import http.client
import json
import os
from pathlib import Path
import pwd
import re
import stat
import subprocess

CONFIG = Path('/etc/oioibawige/console-operator.json')
BUNDLE = Path('/usr/local/lib/oioibawige/console-operator.cjs')
AUDIT = Path('/var/lib/oioi-console-operator')
STATE = Path('/srv/oioibawige/deploy')
CONSOLE = 'oioi-bwg-development-console-1'
HOST = 'console.oioibawige.com'
SAFE_ENV = {'PATH': '/usr/sbin:/usr/bin:/sbin:/bin'}
LOADER = """const fs=require('node:fs'),Module=require('node:module');
const data=fs.readFileSync(0);if(data.length>8008192)throw Error('input');
const length=parseInt(data.subarray(0,8).toString(),16);
if(!Number.isInteger(length)||length<1||length>8000000)throw Error('length');
const m=new Module('/tmp/oioi-console-operator.cjs',module);
m.filename='/tmp/oioi-console-operator.cjs';
m._compile(data.subarray(8,8+length).toString(),m.filename);
m.exports.run(JSON.parse(data.subarray(8+length))).then(v=>{
process.stdout.write(JSON.stringify(v));process.exitCode=v.success?0:1;
}).catch(()=>{process.stdout.write('{"success":false,"code":"OPERATION_FAILED"}');process.exitCode=1;});"""


def require(value):
    if not value:
        raise ValueError('OPERATOR_GUARD_REJECTED')


def protected_read(path, uid=0, limit=8192):
    fd = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(fd, 'rb') as stream:
        info = os.fstat(stream.fileno())
        require(stat.S_ISREG(info.st_mode) and info.st_uid == uid and
                stat.S_IMODE(info.st_mode) == 0o600 and info.st_nlink == 1 and info.st_size <= limit)
        body = stream.read(limit + 1)
        require(len(body) <= limit)
        return body


def root_parents(path):
    for parent in path.parents:
        info = parent.lstat()
        require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o022)


def config_for_operator(config, uid, machine):
    require(set(config) == {'operatorUid', 'machineIdSha256', 'containerId', 'image',
                            'databaseStartedAt', 'bundleSha256', 'releaseId', 'caddyConfigSha256'})
    require(type(config['operatorUid']) is int and config['operatorUid'] == uid and uid >= 1000)
    require(config['machineIdSha256'] == hashlib.sha256(machine.strip()).hexdigest())
    for key in ('containerId', 'bundleSha256', 'releaseId', 'caddyConfigSha256'):
        require(isinstance(config[key], str) and re.fullmatch('[a-f0-9]{64}', config[key]))
    require(isinstance(config['image'], str) and re.fullmatch(
        r'[a-z0-9.-]+(?:/[a-z0-9._-]+)+@sha256:[a-f0-9]{64}', config['image']))
    require(isinstance(config['databaseStartedAt'], str) and
            re.fullmatch(r'\d+\.\d{6}', config['databaseStartedAt']))


def request_for_operator(request):
    require(set(request) == {'args', 'approvalReference', 'reason'})
    require(isinstance(request['approvalReference'], str) and
            re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._:/#-]{0,127}', request['approvalReference']))
    require(isinstance(request['reason'], str) and 0 < len(request['reason'].strip()) <= 200)
    args = request['args']
    require(isinstance(args, list) and 1 <= len(args) <= 20 and
            all(isinstance(v, str) and 0 < len(v) <= 128 for v in args))
    require(args[0] in ('mfa-reset', 'account-access') and '--apply' in args)
    require('--config' not in args and '--reason-file' not in args)


def command(args, data=None):
    return subprocess.run(args, input=data, capture_output=True, env=SAFE_ENV, timeout=45)


def inspect_target(config):
    result = command(['docker', 'inspect', CONSOLE])
    require(result.returncode == 0)
    item = json.loads(result.stdout)[0]
    require(item['Id'] == config['containerId'] and item['Config']['Image'] == config['image'])
    require(item['State']['Running'] and item['State']['Health']['Status'] == 'healthy')
    require(item['Config']['User'] == 'node' and
            'CONSOLE_MFA_ENROLLMENT_ENABLED=false' in item['Config']['Env'])
    require(item['HostConfig']['PortBindings'] == {'3000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '3001'}]})
    require(not os.path.lexists(STATE / 'pending-pair'))
    candidate = json.loads((STATE / 'current-pair/candidate.json').read_text())
    release = hashlib.sha256(json.dumps(candidate, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()
    require(release == config['releaseId'])
    image = candidate['images']['console']
    require(image['repository'] + '@' + image['digest'] == config['image'])
    c = http.client.HTTPConnection('127.0.0.1', 2019, timeout=5)
    try:
        c.request('GET', '/config/'); response = c.getresponse()
        require(response.status == 200)
        routes = json.load(response)
    finally:
        c.close()
    verify_closed_ingress(routes, config['caddyConfigSha256'])


def verify_closed_ingress(routes, expected_hash):
    require(hashlib.sha256(json.dumps(routes, sort_keys=True, separators=(',', ':')).encode()).hexdigest() == expected_hash)
    matches = []
    def walk(value):
        if isinstance(value, dict):
            if HOST in json.dumps(value.get('match', [])):
                serialized = json.dumps(value)
                matches.append('reverse_proxy' not in serialized and
                               ('"status_code": 403' in serialized or '"status_code": "403"' in serialized))
            for child in value.values():
                walk(child)
        elif isinstance(value, list):
            for child in value:
                walk(child)
    walk(routes)
    require(matches and all(matches))


def audit_write(path, value):
    fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as stream:
        json.dump(value, stream)
        stream.flush()
        os.fsync(stream.fileno())
    directory = os.open(path.parent, os.O_RDONLY | os.O_DIRECTORY)
    try:
        os.fsync(directory)
    finally:
        os.close(directory)


def apply(request_path):
    require(os.geteuid() == 0)
    uid = int(os.environ.get('SUDO_UID', '-1'))
    user = os.environ.get('SUDO_USER', '')
    require(user not in ('root', 'ocarun') and pwd.getpwnam(user).pw_uid == uid)
    for path in (CONFIG, BUNDLE, STATE / 'deployment.lock'):
        root_parents(path)
    config = json.loads(protected_read(CONFIG))
    config_for_operator(config, uid, Path('/etc/machine-id').read_bytes())
    body = protected_read(request_path, uid)
    request = json.loads(body)
    request_for_operator(request)
    code = protected_read(BUNDLE, limit=8000000)
    require(hashlib.sha256(code).hexdigest() == config['bundleSha256'])
    root_parents(AUDIT)
    if not AUDIT.exists():
        AUDIT.mkdir(mode=0o700)
    info = AUDIT.lstat()
    require(stat.S_ISDIR(info.st_mode) and info.st_uid == 0 and stat.S_IMODE(info.st_mode) == 0o700)
    fd = os.open(STATE / 'deployment.lock', os.O_RDWR | os.O_NOFOLLOW)
    try:
        info = os.fstat(fd)
        require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and
                not info.st_mode & 0o022 and info.st_nlink == 1)
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        inspect_target(config)
        operation = hashlib.sha256(body).hexdigest()
        started = {'operatorUid': uid, 'utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
                   'approvalReference': request['approvalReference'], 'operationId': operation}
        # Durable attempt before mutation. The same request cannot be submitted twice.
        audit_write(AUDIT / (operation + '.started.json'),
                    {**started, 'args': request['args'], 'reason': request['reason']})
        payload = {'scope': 'oci-console', 'args': request['args'],
                   'serverStartedAt': config['databaseStartedAt']}
        try:
            result = command(['docker', 'exec', '-i', config['containerId'],
                              'node', '--input-type=commonjs', '-e', LOADER],
                             f'{len(code):08x}'.encode() + code + json.dumps(payload).encode())
            value = json.loads(result.stdout)
            require(type(value.get('success')) is bool and
                    set(value) <= {'success', 'code', 'command', 'accountId', 'previousVersion',
                                   'version', 'previousRole', 'previousStatus', 'role', 'status'})
            require(result.returncode == (0 if value['success'] else 1))
            inspect_target(config)
        except Exception:
            value = {'success': False, 'code': 'OUTCOME_UNCERTAIN'}
        audit_write(AUDIT / (operation + '.result.json'), {**started, **value})
        print(json.dumps({**started, **value}))
        return 0 if value['success'] else 1
    finally:
        os.close(fd)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--request', required=True, type=Path)
    parser.add_argument('--apply', required=True, action='store_true')
    try:
        raise SystemExit(apply(parser.parse_args().request))
    except Exception:
        print(json.dumps({'success': False, 'code': 'OPERATOR_GUARD_REJECTED'}))
        raise SystemExit(1)
