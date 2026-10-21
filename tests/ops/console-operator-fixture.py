import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location('operator_host', 'ops/oci/console-operator.py')
host = importlib.util.module_from_spec(spec)
spec.loader.exec_module(host)


class OperatorGuards(unittest.TestCase):
    def test_config_binds_operator_machine_release_and_bundle(self):
        config = {'operatorUid': 1002, 'machineIdSha256': hashlib.sha256(b'fixture').hexdigest(),
                  'containerId': 'a' * 64, 'bundleSha256': 'b' * 64, 'releaseId': 'c' * 64,
                  'caddyConfigSha256': 'd' * 64, 'image': 'registry.example/team/console@sha256:' + 'e' * 64,
                  'databaseStartedAt': '1234567890.000000'}
        host.config_for_operator(config, 1002, b'fixture\n')
        for changes, uid, machine in [({}, 1003, b'fixture'), ({}, 1002, b'other'),
                                     ({'operatorUid': True}, 1002, b'fixture'),
                                     ({'containerId': 'name'}, 1002, b'fixture'),
                                     ({'image': 'registry.example/team/console:latest'}, 1002, b'fixture'),
                                     ({'databaseStartedAt': 'now'}, 1002, b'fixture'),
                                     ({'extra': True}, 1002, b'fixture')]:
            with self.subTest(changes=changes, uid=uid, machine=machine), self.assertRaises(ValueError):
                host.config_for_operator({**config, **changes}, uid, machine)

    def test_files_reject_links_permissions_owner_and_oversize(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'request'
            file.write_bytes(b'{}'); file.chmod(0o600)
            self.assertEqual(host.protected_read(file, os.getuid()), b'{}')
            for uid, limit in [(os.getuid() + 1, 8192), (os.getuid(), 1)]:
                with self.assertRaises(ValueError):
                    host.protected_read(file, uid, limit)
            file.chmod(0o644)
            with self.assertRaises(ValueError):
                host.protected_read(file, os.getuid())
            file.chmod(0o600)
            link = Path(directory) / 'link'
            link.symlink_to(file)
            with self.assertRaises(OSError):
                host.protected_read(link, os.getuid())
            link.unlink(); os.link(file, link)
            with self.assertRaises(ValueError):
                host.protected_read(file, os.getuid())

    def test_request_requires_explicit_apply_and_audit_context(self):
        request = {'args': ['mfa-reset', '--account-id', '1', '--expected-version', '3', '--apply'],
                   'approvalReference': 'P06-D/review-1', 'reason': '승인된 회수 검증'}
        host.request_for_operator(request)
        for changes in [{'reason': ' '}, {'approvalReference': ''}, {'args': request['args'][:-1]},
                        {'args': request['args'] + ['--config', 'override']}, {'extra': 1}]:
            with self.subTest(changes=changes), self.assertRaises(ValueError):
                host.request_for_operator({**request, **changes})

    def test_ingress_must_match_reviewed_closed_configuration(self):
        routes = {'routes': [{'match': [{'host': [host.HOST]}],
                              'handle': [{'handler': 'static_response', 'status_code': 403}]}]}
        digest = lambda value: hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()
        host.verify_closed_ingress(routes, digest(routes))
        opened = copy.deepcopy(routes)
        opened['routes'][0]['handle'] = [{'handler': 'reverse_proxy', 'status_code': 403}]
        for value, fingerprint in [(opened, digest(opened)), (routes, '0' * 64),
                                   ({'routes': []}, digest({'routes': []}))]:
            with self.assertRaises(ValueError):
                host.verify_closed_ingress(value, fingerprint)

    def test_target_rejects_container_release_enrollment_and_port_drift(self):
        image = 'registry.example/team/console@sha256:' + 'e' * 64
        candidate = {'images': {'console': {'repository': 'registry.example/team/console', 'digest': 'sha256:' + 'e' * 64}}}
        config = {'containerId': 'a' * 64, 'image': image, 'caddyConfigSha256': 'fixture',
                  'releaseId': hashlib.sha256(json.dumps(candidate, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()).hexdigest()}
        item = {'Id': 'a' * 64, 'Config': {'Image': image, 'User': 'node', 'Env': ['CONSOLE_MFA_ENROLLMENT_ENABLED=false']},
                'State': {'Running': True, 'Health': {'Status': 'healthy'}},
                'HostConfig': {'PortBindings': {'3000/tcp': [{'HostIp': '127.0.0.1', 'HostPort': '3001'}]}}}
        from types import SimpleNamespace
        from unittest.mock import MagicMock
        connection = MagicMock()
        connection.getresponse.return_value.status = 200
        with tempfile.TemporaryDirectory() as directory:
            state = Path(directory); (state / 'current-pair').mkdir()
            (state / 'current-pair/candidate.json').write_text(json.dumps(candidate))
            with patch.object(host, 'STATE', state), patch.object(host, 'command') as command,                  patch.object(host.http.client, 'HTTPConnection', return_value=connection),                  patch.object(host.json, 'load', return_value={}), patch.object(host, 'verify_closed_ingress'):
                command.return_value = SimpleNamespace(returncode=0, stdout=json.dumps([item]))
                host.inspect_target(config)
                for path, replacement in [(('Id',), 'other'), (('Config', 'Image'), image + '1'),
                                           (('Config', 'User'), 'root'), (('Config', 'Env'), ['CONSOLE_MFA_ENROLLMENT_ENABLED=true']),
                                           (('State', 'Health', 'Status'), 'starting'), (('HostConfig', 'PortBindings'), {})]:
                    changed = copy.deepcopy(item); parent = changed
                    for key in path[:-1]: parent = parent[key]
                    parent[path[-1]] = replacement
                    command.return_value.stdout = json.dumps([changed])
                    with self.subTest(path=path), self.assertRaises(ValueError):
                        host.inspect_target(config)
                command.return_value.stdout = json.dumps([item])
                with self.assertRaises(ValueError):
                    host.inspect_target({**config, 'releaseId': '0' * 64})
                (state / 'pending-pair').touch()
                with self.assertRaises(ValueError):
                    host.inspect_target(config)

    def test_attempt_is_exclusive_and_durable_before_retry(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / 'attempt.started.json'
            host.audit_write(file, {'operationId': 'fixture'})
            self.assertEqual(file.stat().st_mode & 0o777, 0o600)
            with self.assertRaises(FileExistsError):
                host.audit_write(file, {'operationId': 'replacement'})
            self.assertEqual(json.loads(file.read_text())['operationId'], 'fixture')

    def test_deployment_principal_cannot_enter_operator_path(self):
        with patch.object(os, 'geteuid', return_value=0), patch.dict(os.environ, {'SUDO_UID': '1001', 'SUDO_USER': 'ocarun'}):
            with self.assertRaises(ValueError):
                host.apply(Path('/nonexistent/request'))


if __name__ == '__main__':
    unittest.main()
