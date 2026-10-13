#!/usr/bin/env python3
"""Host-owned forwarded IMDS deny; never emit metadata or command diagnostics."""
import json
import re
import subprocess
import sys
from pathlib import Path

TABLE = 'oioi_metadata_guard'
PATHS = [f'/opc/{version}/{path}' for version in ('v2', 'v1') for path in ('instance/', 'identity/cert.pem', 'identity/key.pem')]
RULES = f"""add table inet {TABLE}
delete table inet {TABLE}
table inet {TABLE} {{
  chain forward {{
    type filter hook forward priority -10; policy accept;
    ip daddr 169.254.169.254 counter drop
  }}
}}
"""
DOCKER = ['docker', '--host=unix:///var/run/docker.sock']


def require(condition):
    if not condition:
        raise ValueError()


def command(args, data=None, timeout=10):
    return subprocess.run(args, input=data, text=True, capture_output=True, timeout=timeout, check=True).stdout


def counter():
    objects = json.loads(command(['nft', '-j', 'list', 'table', 'inet', TABLE]))['nftables']
    objects = [item for item in objects if 'metainfo' not in item]
    require(len(objects) == 3)
    table, chain, rule = objects
    require(table['table']['family'] == 'inet' and table['table']['name'] == TABLE)
    chain = chain['chain']
    expected = {'family': 'inet', 'table': TABLE, 'name': 'forward', 'type': 'filter', 'hook': 'forward', 'prio': -10, 'policy': 'accept'}
    require(all((chain.get(key) == value for key, value in expected.items())))
    rule = rule['rule']
    require(rule['family'] == 'inet' and rule['table'] == TABLE and (rule['chain'] == 'forward'))
    match, count, verdict = rule['expr']
    require(match == {'match': {'op': '==', 'left': {'payload': {'protocol': 'ip', 'field': 'daddr'}}, 'right': '169.254.169.254'}})
    require(verdict == {'drop': None})
    packets = count['counter']['packets']
    require(type(packets) is int and packets >= 0)
    return packets


def host_positive():
    for path in PATHS[:3]:
        status = command(['curl', '--silent', '--noproxy', '*', '--connect-timeout', '2', '--max-time', '3', '--output', '/dev/null', '--write-out', '%{http_code}', '--header', 'Authorization: Bearer Oracle', f'http://169.254.169.254{path}'])
        require(status == '200')


def probe(container):
    require(re.fullmatch('[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}', container))
    template = '{"mode":{{json .HostConfig.NetworkMode}},"privileged":{{json .HostConfig.Privileged}},"caps":{{json .HostConfig.CapAdd}},"mounts":{{json .Mounts}},"networks":{{json .NetworkSettings.Networks}}}'
    config = json.loads(command(DOCKER + ['inspect', '--format', template, container]))
    require(not config['privileged'] and (not config['caps']) and (not config['mounts']))
    require(config['mode'] == 'bridge' or config['mode'] in config['networks'])
    require(config['networks'])
    for network in config['networks']:
        require(command(DOCKER + ['network', 'inspect', '--format', '{{.Driver}}', network]).strip() == 'bridge')
    before = counter()
    host_positive()
    source = Path(__file__).with_name('metadata-probe.mjs').read_text()
    result = json.loads(command(DOCKER + ['exec', '-i', container, 'node', '--input-type=module', '-', json.dumps(PATHS)], source, timeout=30))
    require(set(result) == {'blocked'} and result['blocked'] is True)
    require(counter() - before >= len(PATHS))
    host_positive()


def main():
    try:
        args = sys.argv[1:]
        if args == ['apply']:
            command(['nft', '--check', '-f', '-'], RULES)
            command(['nft', '-f', '-'], RULES)
            counter()
        elif args == ['check']:
            counter()
        elif len(args) == 2 and args[0] == 'probe':
            probe(args[1])
        else:
            raise ValueError()
        print('{"event":"metadata_guard_passed"}')
    except (KeyError, ValueError, TypeError, OSError, subprocess.SubprocessError):
        print('{"event":"metadata_guard_failed"}', file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main())
