#!/usr/bin/env python3
"""network=none 테스트 컨테이너 안에서만 합성 host/worker/internet 경로를 검증한다."""
import json
import os
from pathlib import Path
import runpy
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
guard = runpy.run_path(str(ROOT / 'ops/oci/waveform-egress-guard.py'))


def run(*args):
    return subprocess.run(args, check=True, capture_output=True, text=True, timeout=10).stdout


def need(value):
    if not value:
        raise RuntimeError('isolated egress test failed')


# 실 VM에서 직접 실행하거나 host network에 적용하지 않는다.
need(Path('/.dockerenv').is_file() and os.environ.get('P08_ISOLATED_NETWORK_TEST') == '1')
need([link['ifname'] for link in json.loads(run('ip', '-j', 'link'))] == ['lo'])
for space in ('wf-worker', 'wf-internet'):
    run('ip', 'netns', 'add', space)
    run('ip', '-n', space, 'link', 'set', 'lo', 'up')
run('ip', 'link', 'add', guard['BRIDGE'], 'type', 'bridge')
run('ip', 'link', 'set', guard['BRIDGE'], 'up')
run('ip', 'addr', 'add', '172.28.0.1/24', 'dev', guard['BRIDGE'])
run('ip', '-6', 'addr', 'add', 'fd00:1::1/64', 'dev', guard['BRIDGE'], 'nodad')
for space, host, peer, host_ip, remote_ip in (
    ('wf-worker', 'wf-veth', 'wf-peer', None, '172.28.0.2/24'),
    ('wf-internet', 'wf-out', 'wf-remote', '192.0.2.1/24', '192.0.2.2/24'),
):
    run('ip', 'link', 'add', host, 'type', 'veth', 'peer', 'name', peer)
    run('ip', 'link', 'set', peer, 'netns', space)
    run('ip', 'link', 'set', host, 'up')
    if host_ip:
        run('ip', 'addr', 'add', host_ip, 'dev', host)
    else:
        run('ip', 'link', 'set', host, 'master', guard['BRIDGE'])
    run('ip', '-n', space, 'link', 'set', peer, 'up')
    run('ip', '-n', space, 'addr', 'add', remote_ip, 'dev', peer)
run('ip', '-n', 'wf-worker', 'route', 'add', 'default', 'via', '172.28.0.1')
run('ip', '-n', 'wf-internet', 'route', 'add', '172.28.0.0/24', 'via', '192.0.2.1')
for address in ('8.8.8.8', '1.1.1.1', '1.0.0.1', '10.10.0.2', '169.254.169.254'):
    run('ip', '-n', 'wf-internet', 'addr', 'add', address + '/32', 'dev', 'lo')
    run('ip', 'route', 'add', address + '/32', 'via', '192.0.2.2')
run('ip', '-6', 'addr', 'add', 'fd00:2::1/64', 'dev', 'wf-out', 'nodad')
run('ip', '-n', 'wf-worker', '-6', 'addr', 'add', 'fd00:1::2/64', 'dev', 'wf-peer', 'nodad')
run('ip', '-n', 'wf-internet', '-6', 'addr', 'add', 'fd00:2::2/64', 'dev', 'wf-remote', 'nodad')
run('ip', '-n', 'wf-internet', '-6', 'addr', 'add', '2001:4860:4860::8888/128', 'dev', 'lo', 'nodad')
run('ip', '-6', 'route', 'add', '2001:4860:4860::8888/128', 'via', 'fd00:2::2')
run('ip', '-n', 'wf-worker', '-6', 'route', 'add', 'default', 'via', 'fd00:1::1')
run('ip', '-n', 'wf-internet', '-6', 'route', 'add', 'fd00:1::/64', 'via', 'fd00:2::1')

SERVER = '''import selectors,socket
selector=selectors.DefaultSelector()
for family,host in ((socket.AF_INET,'0.0.0.0'),(socket.AF_INET6,'::')):
 for port in (22,53,80,443):
  s=socket.socket(family,socket.SOCK_STREAM)
  if family==socket.AF_INET6:s.setsockopt(socket.IPPROTO_IPV6,socket.IPV6_V6ONLY,1)
  s.bind((host,port));s.listen();selector.register(s,selectors.EVENT_READ,'tcp')
s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM);s.bind(('0.0.0.0',53));selector.register(s,selectors.EVENT_READ,'udp')
print('ready',flush=True)
while True:
 for key,_ in selector.select():
  if key.data=='tcp':c,_=key.fileobj.accept();c.close()
  else:data,peer=key.fileobj.recvfrom(1024);key.fileobj.sendto(b'ok',peer)
'''
PROBE = '''import socket,sys
address,port,protocol=sys.argv[1:];family=socket.AF_INET6 if ':' in address else socket.AF_INET
s=socket.socket(family,socket.SOCK_DGRAM if protocol=='udp' else socket.SOCK_STREAM);s.settimeout(0.4)
try:
 if protocol=='udp':s.sendto(b'probe',(address,int(port)));s.recvfrom(2)
 else:s.connect((address,int(port)))
 print('reachable')
except OSError:print('blocked')
finally:s.close()
'''
servers = []
try:
    for prefix in ([], ['ip', 'netns', 'exec', 'wf-internet']):
        process = subprocess.Popen([*prefix, 'python3', '-u', '-c', SERVER], stdout=subprocess.PIPE, text=True)
        servers.append(process)
        need(process.stdout.readline().strip() == 'ready')
    # 기존 Web/Console table을 실제 커널에 넣고 새 table 교체 전후 그대로인지 확인한다.
    run('python3', '-I', str(ROOT / 'ops/oci/metadata-guard.py'), 'apply')
    prior = run('nft', '-j', 'list', 'table', 'inet', 'oioi_metadata_guard')
    guard['apply']()
    guard['apply']()
    need(prior == run('nft', '-j', 'list', 'table', 'inet', 'oioi_metadata_guard'))
    cases = [('8.8.8.8', 80, 'tcp', True), ('8.8.8.8', 443, 'tcp', True),
             ('1.1.1.1', 53, 'udp', True), ('1.0.0.1', 53, 'tcp', True),
             ('172.28.0.1', 80, 'tcp', False), ('10.10.0.2', 80, 'tcp', False),
             ('169.254.169.254', 80, 'tcp', False), ('8.8.8.8', 22, 'tcp', False),
             ('8.8.8.8', 53, 'udp', False), ('2001:4860:4860::8888', 80, 'tcp', False)]
    for address, port, protocol, allowed in cases:
        # 차단 시험도 목적지가 살아 있음을 host 양성 대조로 먼저 확인한다.
        positive = run('python3', '-c', PROBE, address, str(port), protocol).strip()
        if positive != 'reachable':
            raise RuntimeError('host positive failed: ' + address + ':' + str(port) + '/' + protocol)
        result = run('ip', 'netns', 'exec', 'wf-worker', 'python3', '-c', PROBE, address, str(port), protocol).strip()
        need(result == ('reachable' if allowed else 'blocked'))
    need(guard['check_rules']() > 0)
    # rule 제거가 검증을 통과하지 못하는지 실제 커널 drift로 확인한다.
    run('nft', 'flush', 'chain', 'inet', guard['TABLE'], 'input')
    try:
        guard['check_rules']()
        raise RuntimeError('drift accepted')
    except ValueError:
        pass
    print(json.dumps({'event': 'isolated_waveform_egress_passed', 'cases': len(cases)}))
finally:
    for process in servers:
        process.terminate()
        process.wait(timeout=3)
