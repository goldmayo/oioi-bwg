"""Isolated orchestration tests; all values and subprocess responses are fixtures."""
import base64
import contextlib
import datetime
import importlib.util
import io
import json
import os
from pathlib import Path
import runpy
import stat
import subprocess
import sys
import tarfile
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2] / "ops" / "oci"
INSTANCE = 'ocid1.instance.oc1.ap-osaka-1.fixture'
COMPARTMENT = 'ocid1.compartment.oc1..fixture'
COMMAND = 'ocid1.instanceagentcommand.oc1.ap-osaka-1.fixture'
MARKER = {'sourceSha': 'a' * 40, 'runId': 12, 'runAttempt': 1}
PREFIX = 'ap-osaka-1.ocir.io/fixture'
ENV = {'SOURCE_SHA': MARKER['sourceSha'], 'GITHUB_RUN_ID': '12', 'GITHUB_RUN_ATTEMPT': '1', 'OCIR_REGISTRY': 'ap-osaka-1.ocir.io', 'OCIR_NAMESPACE': 'fixture', 'OCI_CLI_KEY_CONTENT': 'SENSITIVE-FAKE', 'OCI_COMPUTE_INSTANCE_OCID': INSTANCE, 'OCI_COMPUTE_COMPARTMENT_OCID': COMPARTMENT}


def load(name):
    spec = importlib.util.spec_from_file_location(name.replace('-', '_'), ROOT / (name + '.py'))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class CiProbe(unittest.TestCase):
    def execute(self, mode, variant='ok'):
        calls, keys = [], []
        def fake(args, **kwargs):
            calls.append(args)
            if args[0] == 'docker':
                if args[1] == 'build' and variant == 'build-fail':
                    raise subprocess.TimeoutExpired(args, 90, 'SENSITIVE-FAKE', 'SENSITIVE-FAKE')
                if args[1] == 'push' and variant in ('push-fail', 'push-denied'):
                    detail = 'denied SENSITIVE-FAKE' if variant == 'push-denied' else 'SENSITIVE-FAKE'
                    raise subprocess.CalledProcessError(1, args, detail, detail)
                if args[1] == 'push' and 'oioi-bwg-console:' in args[-1] and variant == 'console-push-fail':
                    raise subprocess.CalledProcessError(1, args, 'SENSITIVE-FAKE', 'SENSITIVE-FAKE')
                if args[1:3] == ['image', 'inspect']:
                    repo = args[-1].rsplit(':', 1)[0]
                    output = [repo + '@sha256:' + '1' * 64]
                    if variant == 'digest-mismatch': output = ['other@sha256:' + '2' * 64]
                    return subprocess.CompletedProcess(args, 0, json.dumps(output), '')
                return subprocess.CompletedProcess(args, 0, '', '')
            env = kwargs['env']
            self.assertNotIn('OCI_CLI_KEY_CONTENT', env)
            key = Path(env['OCI_CLI_KEY_FILE']); keys.append(key)
            self.assertEqual(stat.S_IMODE(key.stat().st_mode), 0o600)
            self.assertEqual(key.read_text(), 'SENSITIVE-FAKE')
            if 'compute' in args:
                data = {'id': INSTANCE, 'compartment-id': COMPARTMENT if variant != 'wrong-instance' else 'other'}
            elif 'create' in args:
                content = json.loads(args[args.index('--content') + 1])
                self.assertEqual(content['source']['text'], 'sudo /srv/oioibawige/scripts/run-command-probe.sh')
                data = {'id': COMMAND}
            else:
                count = sum('command-execution' in call for call in calls)
                if variant == 'not-ready' and count == 1:
                    raise subprocess.CalledProcessError(1, args, '', 'NotAuthorizedOrNotFound SENSITIVE-FAKE')
                if variant == 'api-fail':
                    raise subprocess.CalledProcessError(1, args, '', 'SENSITIVE-FAKE')
                data = {'instance-id': INSTANCE, 'instance-agent-command-id': COMMAND if variant != 'wrong-command' else 'other', 'lifecycle-state': 'SUCCEEDED', 'content': {'exit-code': 1 if variant == 'nonzero' else 0, 'text': 'SENSITIVE-FAKE'}, 'time-created': datetime.datetime.now(datetime.timezone.utc).isoformat()}
            return subprocess.CompletedProcess(args, 0, json.dumps({'data': data}), '')
        output, errors = io.StringIO(), io.StringIO()
        with tempfile.TemporaryDirectory() as directory:
            before = Path.cwd(); os.chdir(directory)
            try:
                with patch.dict(os.environ, ENV), patch.object(sys, 'argv', ['probe', mode]), patch('subprocess.run', fake), patch('time.sleep'), contextlib.redirect_stdout(output), contextlib.redirect_stderr(errors):
                    try:
                        runpy.run_path(str(ROOT / 'b0-ci-probe.py'), run_name='__main__')
                        status = 0
                    except SystemExit as error:
                        status = error.code
                files = {p.name: json.loads(p.read_text()) for p in Path('.').glob('*.json')}
            finally: os.chdir(before)
        self.assertNotIn('SENSITIVE-FAKE', output.getvalue() + errors.getvalue() + json.dumps(files))
        self.events = [json.loads(line) for line in output.getvalue().splitlines()]
        self.assertTrue(all(not key.exists() for key in keys))
        return status, calls, files

    def test_publish_both_digests(self):
        status, calls, files = self.execute('publish')
        self.assertEqual(status, 0)
        self.assertEqual(len([c for c in calls if c[1] == 'push']), 2)
        self.assertEqual(set(files['b0-proof.json']['images']), {'web', 'console'})
        self.assertNotIn('candidate.json', files)

    def test_publish_failure_stops_and_hides_raw_output(self):
        for variant in ('push-fail', 'push-denied', 'digest-mismatch', 'build-fail', 'console-push-fail'):
            with self.subTest(variant=variant):
                status, calls, files = self.execute('publish', variant)
                self.assertEqual(status, 1); self.assertEqual(files, {})
                self.assertEqual(len([c for c in calls if c[1] == 'push']), 0 if variant == 'build-fail' else 2 if variant == 'console-push-fail' else 1)
                phases = [e['phase'] for e in self.events if e['event'] == 'b0_publish_phase']
                expected = {'build-fail': 'build', 'console-push-fail': 'console.push', 'digest-mismatch': 'web.digest'}.get(variant, 'web.push')
                self.assertEqual(phases[-1], expected)
                if variant != 'digest-mismatch':
                    failed = [e for e in self.events if e['event'] == 'b0_publish_step_failed']
                    reason = {'build-fail': 'timeout', 'push-denied': 'permission_denied'}.get(variant, 'command_failed')
                    self.assertEqual(failed, [{'event': 'b0_publish_step_failed', 'phase': expected, 'reason': reason}])

    def test_new_command_success_and_eventual_consistency(self):
        for variant in ('ok', 'not-ready'):
            status, calls, files = self.execute('command', variant)
            self.assertEqual(status, 0)
            self.assertEqual(sum('create' in c for c in calls), 1)
            self.assertEqual(files['b0-command-proof.json']['exitCode'], 0)
            self.assertNotIn('ocid1.', json.dumps(files))

    def test_reject_wrong_target_wrong_execution_or_failed_exit(self):
        for variant in ('wrong-instance', 'wrong-command', 'nonzero', 'api-fail'):
            with self.subTest(variant=variant):
                status, calls, files = self.execute('command', variant)
                self.assertEqual(status, 1); self.assertEqual(files, {})
                if variant == 'wrong-instance': self.assertFalse(any('create' in c for c in calls))


class HostProbe(unittest.TestCase):
    def fixture(self, variant):
        module, calls = load('b0-host-probe'), []
        proof = {'marker': MARKER, 'images': {app: f'{PREFIX}/{name}@sha256:' + '1' * 64 for app, name in [('web', 'oioi-bwg'), ('console', 'oioi-bwg-console')]}}
        secrets = {'auth': 'ocid1.vaultsecret.oc1.ap-osaka-1.authfixture', 'mfa': 'ocid1.vaultsecret.oc1.ap-osaka-1.mfafixture'}
        def fake(args, binary=False):
            calls.append(args)
            if 'metadata-guard.py' in ' '.join(args):
                if variant == 'guard-fail': raise ValueError()
                return ''
            if 'inspect' in args and 'image' not in args: return f'{PREFIX}/oioi-bwg@sha256:' + '0' * 64
            if 'image' in args: return json.dumps({'Architecture': 'arm64', 'Size': 1024, 'Config': {'Env': ['PATH=/p06-b0-no-binaries']}})
            if 'cp' in args:
                blob = io.BytesIO(); value = json.dumps(MARKER if variant != 'marker-mismatch' else {'other': 1}).encode()
                with tarfile.open(fileobj=blob, mode='w') as archive:
                    info = tarfile.TarInfo('p06-b0-marker'); info.size = len(value); archive.addfile(info, io.BytesIO(value))
                return blob.getvalue()
            if args[0] == 'oci':
                secret = args[args.index('--secret-id') + 1]
                value = 'x' * 32 if secret == secrets['auth'] else base64.b64encode(b'x' * 32).decode()
                if variant == 'short-auth': value = 'short'
                return json.dumps({'data': {'secret-id': secret, 'version-number': 1, 'secret-bundle-content': {'content': base64.b64encode(value.encode()).decode()}}})
            return ''
        return module, calls, proof, secrets, fake

    def test_pull_and_current_secret_format(self):
        module, calls, proof, secrets, fake = self.fixture('ok')
        with patch.object(module, 'run', fake): self.assertEqual(module.probe(proof, secrets), {'auth': 1, 'mfa': 1})
        self.assertEqual(sum('pull' in c for c in calls), 2)
        self.assertEqual(sum('rm' in c for c in calls), 2)
        self.assertEqual(sum(c[0] == 'oci' for c in calls), 2)
        self.assertFalse(any('start' in c or 'run' in c for c in calls))

    def test_marker_mismatch_cleans_up_and_never_reads_secrets(self):
        module, calls, proof, secrets, fake = self.fixture('marker-mismatch')
        with patch.object(module, 'run', fake), self.assertRaises(ValueError): module.probe(proof, secrets)
        self.assertEqual(sum('rm' in c for c in calls), 1)
        self.assertFalse(any(c[0] == 'oci' for c in calls))

    def test_partial_create_failure_attempts_cleanup(self):
        module, calls, proof, secrets, fake = self.fixture('ok')
        def create_fails(args, binary=False):
            if 'create' in args:
                calls.append(args)
                raise subprocess.TimeoutExpired(args, 120)
            return fake(args, binary)
        with patch.object(module, 'run', create_fails), self.assertRaises(subprocess.TimeoutExpired): module.probe(proof, secrets)
        self.assertEqual(sum('rm' in c for c in calls), 1)
        self.assertFalse(any(c[0] == 'oci' for c in calls))

    def test_unexpected_image_environment_stops_before_container_creation(self):
        module, calls, proof, secrets, fake = self.fixture('ok')
        def unsafe_image(args, binary=False):
            if 'image' in args:
                calls.append(args)
                return json.dumps({'Architecture': 'arm64', 'Size': 1024, 'Config': {'Env': ['SECRET=SENSITIVE-FAKE']}})
            return fake(args, binary)
        with patch.object(module, 'run', unsafe_image), self.assertRaises(ValueError): module.probe(proof, secrets)
        self.assertFalse(any('create' in c or c[0] == 'oci' for c in calls))

    def test_guard_failure_prevents_any_pull_or_secret(self):
        module, calls, proof, secrets, fake = self.fixture('guard-fail')
        with patch.object(module, 'run', fake), self.assertRaises(ValueError): module.probe(proof, secrets)
        self.assertEqual(len(calls), 1)

    def test_invalid_secret_stops_before_next_secret(self):
        module, calls, proof, secrets, fake = self.fixture('short-auth')
        with patch.object(module, 'run', fake), self.assertRaises(ValueError): module.probe(proof, secrets)
        self.assertEqual(sum(c[0] == 'oci' for c in calls), 1)


if __name__ == '__main__': unittest.main(verbosity=2)
