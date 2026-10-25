import base64
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
MFA = base64.b64encode(bytes(32)).decode()
VALUES = dict(db='fixture-p@ss', web='fixture-web-auth-secret',
              auth='fixture-console-auth-secret-32-characters', mfa=MFA,
              r2id='fixture-r2-id', r2secret='fixture-r2-secret')


class RuntimeEnvTest(unittest.TestCase):
    def run_case(self, app, variant='valid'):
        with tempfile.TemporaryDirectory(prefix='runtime-env-') as temporary:
            root = Path(temporary)
            public = 'R2_BUCKET=literal$bucket#"quote\n' if app == 'web' else 'CONSOLE_ORIGIN=http://127.0.0.1:3001\n'
            names = {'db': 'DB_APP_PASSWORD', **({'web': 'AUTH_SECRET'} if app == 'web' else
                     {'auth': 'CONSOLE_AUTH_SECRET', 'mfa': 'CONSOLE_MFA_ENCRYPTION_KEY',
                      'r2id': 'R2_ACCESS_KEY_ID', 'r2secret': 'R2_SECRET_ACCESS_KEY'})}
            mapping = ''.join(f'{name}=ocid1.vaultsecret.test.{key}\n' for key, name in names.items())
            secrets = dict(VALUES)
            if variant == 'foreign-public': public += 'CONSOLE_ORIGIN=http://localhost:3001\n' if app == 'web' else 'EMAIL_DELIVERY_MODE=dev\n'
            if variant == 'public-secret': public += 'AUTH_SECRET=' + VALUES['web'] + '\n'
            if variant == 'foreign-key': mapping += 'CONSOLE_AUTH_SECRET=ocid1.vaultsecret.test.auth\n' if app == 'web' else 'AUTH_SECRET=ocid1.vaultsecret.test.web\n'
            if variant == 'duplicate': mapping += 'DB_APP_PASSWORD=ocid1.vaultsecret.test.db\n'
            if variant in {'missing', 'missing-auth'}:
                key = 'AUTH_SECRET' if app == 'web' else ('CONSOLE_AUTH_SECRET' if variant == 'missing-auth' else 'CONSOLE_MFA_ENCRYPTION_KEY')
                mapping = '\n'.join(line for line in mapping.splitlines() if not line.startswith(key + '='))
            if variant == 'origin': public = 'CONSOLE_ORIGIN=http://console.example\n'
            if variant == 'https': public = 'CONSOLE_ORIGIN=https://console.example\n'
            if variant.startswith('bad-origin:'): public = 'CONSOLE_ORIGIN=' + variant.split(':', 1)[1] + '\n'
            if variant == 'short-auth': secrets['auth'] = 'short'
            if variant == 'invalid-mfa': secrets['mfa'] = MFA[:-1]
            if variant == 'same-key': secrets['auth'] = MFA
            if variant == 'newline': secrets['db'] += '\n'
            if app == 'console':
                public += ('R2_ENDPOINT=https://account.r2.cloudflarestorage.com\n'
                           'R2_BUCKET=fixture-albums\nASSETS_PUBLIC_BASE_URL=https://assets.example.test\n')
                if variant.startswith('missing-upload:'):
                    field = variant.split(':', 1)[1]
                    public = '\n'.join(line for line in public.splitlines() if not line.startswith(field + '=')) + '\n'
                    mapping = '\n'.join(line for line in mapping.splitlines() if not line.startswith(field + '=')) + '\n'
            for name, value in {'public': public, 'mapping': mapping, 'output': 'previous-env', 'values': json.dumps(secrets)}.items():
                (root / name).write_text(value)
            (root / 'output').chmod(0o644)
            (root / 'oci').write_text('''#!/usr/bin/python3
import base64, json, os, pathlib, sys
root=pathlib.Path(os.environ['MOCK_ROOT']); args=sys.argv[1:]
with (root/'calls').open('a') as f: f.write(json.dumps(args)+'\\n')
if os.environ.get('MOCK_ERROR'):
    print('fixture-console-auth-secret-32-characters', file=sys.stderr); sys.exit(1)
key=args[args.index('--secret-id')+1].rsplit('.',1)[-1]
print(base64.b64encode(json.loads((root/'values').read_text())[key].encode()).decode())
''')
            (root / 'oci').chmod(0o700)
            result = subprocess.run(['python3', '-I', str(ROOT / 'ops/oci/materialize-runtime-env.py'), app,
                                     str(root/'public'), str(root/'mapping'), str(root/'output')],
                                    capture_output=True, text=True, timeout=5, env={
                'PATH': str(root) + ':' + os.environ['PATH'], 'MOCK_ROOT': str(root),
                'MOCK_ERROR': '1' if variant == 'oci-error' else '', 'DATABASE_HOST': 'postgres',
                'DATABASE_PORT': '5432', 'DATABASE_NAME': 'oioibawige', 'DATABASE_USER': 'oioi_app',
                'AUTH_SECRET': 'ambient-auth-is-not-a-console-fallback'})
            self.assertEqual(result.stdout, '')
            for value in VALUES.values(): self.assertNotIn(value, result.stderr)
            calls = [json.loads(line) for line in (root/'calls').read_text().splitlines()] if (root/'calls').exists() else []
            return result, (root/'output').read_text(), calls, (root/'output').stat().st_mode & 0o777

    def test_app_env(self):
        for app in ('web', 'console'):
            with self.subTest(app=app):
                result, output, calls, mode = self.run_case(app)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(mode, 0o600)
                self.assertIn('DATABASE_URL=postgresql://oioi_app:fixture-p%40ss@postgres:5432/oioibawige\n', output)
                self.assertNotIn('DB_APP_PASSWORD=', output)
                self.assertTrue(calls and all('instance_principal' in args and 'CURRENT' in args for args in calls))
                if app == 'web':
                    self.assertIn('R2_BUCKET=literal$bucket#"quote\n', output)
                    self.assertNotIn('CONSOLE_', output)
                else:
                    self.assertIn('CONSOLE_MFA_ENCRYPTION_KEY=' + MFA + '\n', output)
                    self.assertIn('CONSOLE_MFA_ENROLLMENT_ENABLED=false\n', output)
                    self.assertNotRegex(output, r'(?m)^AUTH_SECRET=')

    def test_invalid_input(self):
        for app in ('web', 'console'):
            for variant in ('public-secret', 'foreign-key', 'foreign-public', 'duplicate', 'missing', 'newline', 'oci-error'):
                with self.subTest(app=app, variant=variant):
                    result, output, calls, _ = self.run_case(app, variant)
                    self.assertEqual(result.returncode, 1)
                    self.assertEqual(output, 'previous-env')
                    if variant not in {'newline', 'oci-error'}: self.assertEqual(calls, [])

    def test_https_origin(self):
        result, output, _, _ = self.run_case('console', 'https')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('CONSOLE_ORIGIN=https://console.example\n', output)
        for origin in ('https://user@console.example', 'https://console.example/admin',
                       'https://console.example?', 'https://console.example#',
                       'https://console.example:0', 'https:console.example',
                       'https://console example', 'https://console.example\\evil',
                       'https://%65xample.com'):
            result, output, calls, _ = self.run_case('console', 'bad-origin:' + origin)
            self.assertEqual(result.returncode, 1)
            self.assertEqual(output, 'previous-env')
            self.assertEqual(calls, [])

    def test_missing_upload_configuration(self):
        for field in ('R2_ENDPOINT', 'R2_BUCKET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'ASSETS_PUBLIC_BASE_URL'):
            with self.subTest(field=field):
                result, output, calls, _ = self.run_case('console', 'missing-upload:' + field)
                self.assertEqual(result.returncode, 1)
                self.assertEqual(output, 'previous-env')
                self.assertEqual(calls, [])

    def test_console_contract(self):
        for variant in ('origin', 'short-auth', 'invalid-mfa', 'same-key', 'missing-auth'):
            with self.subTest(variant=variant):
                result, output, _, _ = self.run_case('console', variant)
                self.assertEqual(result.returncode, 1)
                self.assertEqual(output, 'previous-env')


if __name__ == '__main__':
    unittest.main()
