#!/usr/bin/env python3
"""Root-only B0 pull/Secret checks; never emit response bodies or secret hashes."""
import base64
import io
import json
import os
import re
import stat
import subprocess
import sys
import tarfile
import uuid
from pathlib import Path

DOCKER = ['docker', '--host=unix:///var/run/docker.sock']


def require(value):
    if not value:
        raise ValueError()


def run(args, binary=False):
    return subprocess.run(args, text=not binary, capture_output=True, timeout=120, check=True).stdout


def protected_json(filename):
    path = Path(filename)
    info = path.lstat()
    require(stat.S_ISREG(info.st_mode) and info.st_uid == 0 and not info.st_mode & 0o077 and info.st_nlink == 1)
    return json.loads(path.read_text())


def probe(proof, secrets):
    require(set(proof['images']) == {'web', 'console'} and set(secrets) == {'auth', 'mfa'})
    require(secrets['auth'] != secrets['mfa'])
    marker = proof['marker']
    require(re.fullmatch('[0-9a-f]{40}', marker['sourceSha']) and all(type(marker[key]) is int and marker[key] > 0 for key in ('runId', 'runAttempt')))
    guard = ['python3', '-I', '/usr/local/lib/oioi-metadata-guard/metadata-guard.py']
    run(guard + ['check'])
    run(guard + ['probe', 'oioi-bwg-development-app-1'])
    reference = run(DOCKER + ['inspect', '--format', '{{.Config.Image}}', 'oioi-bwg-development-app-1']).strip()
    require(re.fullmatch(r'(ap-osaka-1|kix)\.ocir\.io/[a-z0-9]+/oioi-bwg@sha256:[0-9a-f]{64}', reference))
    prefix = reference.split('@')[0].rsplit('/', 1)[0]
    for app, name in (('web', 'oioi-bwg'), ('console', 'oioi-bwg-console')):
        image = proof['images'][app]
        require(re.fullmatch(re.escape(prefix + '/' + name) + r'@sha256:[0-9a-f]{64}', image))
        run(DOCKER + ['pull', '--platform', 'linux/arm64', image])
        data = json.loads(run(DOCKER + ['image', 'inspect', '--format', '{{json .}}', image]))
        require(data['Architecture'] == 'arm64' and data['Size'] < 65536 and not data['Config'].get('Volumes') and data['Config'].get('Env') == ['PATH=/p06-b0-no-binaries'])
        container = 'p06-b0-' + uuid.uuid4().hex
        try:
            run(DOCKER + ['create', '--name', container, '--network', 'none', '--entrypoint', '/p06-b0-marker', image])
            archive = run(DOCKER + ['cp', container + ':/p06-b0-marker', '-'], binary=True)
            with tarfile.open(fileobj=io.BytesIO(archive)) as source:
                member = source.getmember('p06-b0-marker')
                require(member.isfile() and member.size < 4096)
                require(json.load(source.extractfile(member)) == proof['marker'])
        finally:
            run(DOCKER + ['rm', container])
    versions = {}
    for kind in ('auth', 'mfa'):
        require(re.fullmatch(r'ocid1\.vaultsecret\.[a-z0-9.-]+', secrets[kind]))
        data = json.loads(run(['oci', 'secrets', 'secret-bundle', 'get', '--auth', 'instance_principal', '--secret-id', secrets[kind], '--stage', 'CURRENT']))['data']
        require(data['secret-id'] == secrets[kind])
        value = base64.b64decode(data['secret-bundle-content']['content'], validate=True).decode('utf-8')
        if kind == 'auth':
            require(len(value) >= 32)
        else:
            raw = base64.b64decode(value, validate=True)
            require(len(raw) == 32 and base64.b64encode(raw).decode() == value)
        require(type(data['version-number']) is int and data['version-number'] > 0)
        versions[kind] = data['version-number']
    return versions


if __name__ == '__main__':
    try:
        require(os.geteuid() == 0 and len(sys.argv) == 3)
        versions = probe(protected_json(sys.argv[1]), protected_json(sys.argv[2]))
        print(json.dumps({'event': 'b0_host_probe_passed', 'versions': versions}))
    except (KeyError, ValueError, TypeError, OSError, tarfile.TarError, subprocess.SubprocessError):
        print('{"event":"b0_host_probe_failed"}')
        raise SystemExit(1)
