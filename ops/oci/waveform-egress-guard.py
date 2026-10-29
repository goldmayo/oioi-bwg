#!/usr/bin/env python3
"""Worker 전용 bridge의 host/private 접근을 차단한다. 기존 table은 수정하지 않는다."""
import ipaddress
import json
import subprocess
import sys

TABLE = 'oioi_waveform_guard'
BRIDGE = 'oioi-wf0'
NETWORK = 'oioi-waveform-egress'
DNS = ('1.1.1.1', '1.0.0.1')
PRIVATE = ('0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
           '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.0.2.0/24',
           '192.168.0.0/16', '198.18.0.0/15', '198.51.100.0/24',
           '203.0.113.0/24', '224.0.0.0/4', '240.0.0.0/4')


def require(condition):
    if not condition:
        raise ValueError()


def command(args, data=None):
    return subprocess.run(args, input=data, text=True, capture_output=True,
                          check=True, timeout=10).stdout


def match(left, right):
    return {'match': {'op': '==', 'left': left, 'right': right}}


def expected():
    base = {'family': 'inet', 'table': TABLE}
    objects = [{'table': {'family': 'inet', 'name': TABLE}}]
    source = match({'meta': {'key': 'iifname'}}, BRIDGE)

    def chain(name):
        objects.append({'chain': dict(base, name=name, type='filter', hook=name,
                                      prio=-20, policy='accept')})

    def rule(name, conditions, verdict):
        objects.append({'rule': dict(base, chain=name, expr=[source, *conditions,
            {'counter': {'packets': 0, 'bytes': 0}}, {verdict: None}])})

    def address(value):
        return match({'payload': {'protocol': 'ip', 'field': 'daddr'}}, value)

    def port(protocol, number):
        return [match({'payload': {'protocol': protocol, 'field': 'dport'}}, number)]

    chain('input')
    rule('input', [], 'drop')
    chain('forward')
    rule('forward', [match({'meta': {'key': 'nfproto'}}, 'ipv6')], 'drop')
    for cidr in PRIVATE:
        network = ipaddress.ip_network(cidr)
        rule('forward', [address({'prefix': {'addr': str(network.network_address),
                                            'len': network.prefixlen}})], 'drop')
    for resolver in DNS:
        for protocol in ('udp', 'tcp'):
            rule('forward', [address(resolver), *port(protocol, 53)], 'accept')
    for number in (80, 443):
        rule('forward', port('tcp', number), 'accept')
    rule('forward', [], 'drop')
    return sorted(objects, key=lambda item: 0 if 'table' in item else 1 if 'chain' in item else 2)


def check_rules():
    observed = json.loads(command(['nft', '-j', 'list', 'table', 'inet', TABLE]))['nftables']
    observed = [item for item in observed if 'metainfo' not in item]
    packets = 0
    for item in observed:
        for body in item.values():
            body.pop('handle', None)
            for expression in body.get('expr', []):
                if 'counter' in expression:
                    count = expression['counter']
                    require(set(count) == {'packets', 'bytes'} and
                            all(type(v) is int and v >= 0 for v in count.values()))
                    packets += count['packets']
                    expression['counter'] = {'packets': 0, 'bytes': 0}
    require(observed == expected())
    return packets


def check_network():
    networks = json.loads(command(['docker', '--host=unix:///var/run/docker.sock',
                                   'network', 'inspect', NETWORK]))
    require(len(networks) == 1)
    network = networks[0]
    require(network['Name'] == NETWORK and network['Driver'] == 'bridge' and
            network['Scope'] == 'local' and network['EnableIPv6'] is False and
            network['Internal'] is False and network['Labels'].get('com.oioi.waveform.network') == '1')
    require(network['Options'].get('com.docker.network.bridge.name') == BRIDGE and
            network['Options'].get('com.docker.network.bridge.enable_icc') == 'false')


def apply():
    table = {'family': 'inet', 'name': TABLE}
    transaction = json.dumps({'nftables': [{'add': {'table': table}}, {'delete': {'table': table}},
                                          *[{'add': item} for item in expected()]]})
    command(['nft', '--check', '-j', '-f', '-'], transaction)
    command(['nft', '-j', '-f', '-'], transaction)
    check_rules()


def main():
    try:
        if sys.argv[1:] == ['apply']:
            apply()
        elif sys.argv[1:] == ['check']:
            check_rules()
            check_network()
        else:
            raise ValueError()
        print('{"event":"waveform_egress_guard_passed"}')
        return 0
    except (KeyError, ValueError, TypeError, AttributeError, IndexError, OSError, subprocess.SubprocessError):
        print('{"event":"waveform_egress_guard_failed"}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
