#!/usr/bin/env python3
"""공개 Console 조각의 Runner API 차단을 외부망 없는 실제 Caddy에서 확인한다."""
import json
from pathlib import Path
import re
import subprocess
import tempfile
import time

IMAGE = 'caddy:2.6.2-alpine@sha256:25a0097607868fb05a89a5ab9fea2f2ea4cecdc89d887d7dcee8c778a21b9e1f'
ROOT = Path(__file__).resolve().parents[2]


def run(*args):
    return subprocess.run(args, text=True, capture_output=True, check=True, timeout=60).stdout


def request(container, path, expected, method='GET', port=8080):
    args = ['docker', 'exec', container, 'wget', '-S', '-O', '-']
    if method == 'POST':
        args += ['--post-data=fixture']
    result = subprocess.run([*args, f'http://127.0.0.1:{port}{path}'],
                            text=True, capture_output=True, timeout=5)
    status = re.search(r'HTTP/1\.1 (\d{3})', result.stderr)
    if not status or int(status[1]) != expected or (expected == 200 and result.stdout.strip() != 'fixture-upstream'):
        raise RuntimeError('Console ingress boundary failed: ' + method + ' ' + path)
    if expected == 404 and result.stdout:
        raise RuntimeError('Internal request reached fixture upstream')


# 공개 peer/IP 확인은 기존 경계다. 그 뒤 실제 import되는 snippet을 변경 없이 실행한다.
source = (ROOT / 'ops/oci/console.Caddyfile').read_text()
snippet = source.split('\nconsole.oioibawige.com {')[0]
if '(console_upstream)' not in snippet or snippet == source:
    raise RuntimeError('Console snippet missing')
config = '{\n admin off\n auto_https off\n}\n' + snippet + '''
http://127.0.0.1:8080 {
 import console_upstream console.oioibawige.com 127.0.0.1
}
http://:3001 {
 respond "fixture-upstream" 200
}
'''
with tempfile.TemporaryDirectory(prefix='p08-console-ingress-') as directory:
    path = Path(directory) / 'Caddyfile'
    path.write_text(config)
    container = run('docker', 'run', '-d', '--rm', '--network', 'none', '--read-only',
                    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--log-driver', 'none',
                    '--tmpfs', '/data', '--tmpfs', '/config', '-v', str(path) + ':/etc/caddy/Caddyfile:ro', IMAGE).strip()
    try:
        run('docker', 'exec', container, 'caddy', 'validate', '--config', '/etc/caddy/Caddyfile')
        deadline = time.monotonic() + 5
        while True:
            try:
                request(container, '/ready', 200, port=3001)
                break
            except RuntimeError:
                if time.monotonic() >= deadline:
                    raise
                time.sleep(0.1)
        denied = ['/api/internal', '/api/internal/waveform-jobs/x', '/api/internal/x?x=1',
                  '/api/%69nternal/x', '/api%2finternal/x', '/api//internal/x', '/api/internal/../internal/x']
        allowed = ['/admin-login', '/api/admin/songs', '/api/internal-other']
        for method in ('GET', 'POST'):
            for value in denied:
                request(container, value, 404, method)
            for value in allowed:
                request(container, value, 200, method)
        request(container, '/api/internal/waveform-jobs/x', 200, port=3001)
        print(json.dumps({'event': 'console_runner_ingress_passed', 'cases': 21}))
    finally:
        run('docker', 'rm', '-f', container)
