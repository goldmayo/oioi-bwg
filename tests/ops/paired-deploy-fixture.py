import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
SECRET = 'fixture-console-private-secret-32-characters'


def digest(c): return 'sha256:' + c * 64


def identity(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, separators=(',', ':')).encode()).hexdigest()


def candidate(source='a', web='b', console='c', baseline=None):
    return dict(prNumber=142, sourceSha=source * 40, sourceTree='d' * 40, runId=17, runAttempt=1,
                buildConfigHash='e' * 64, baseline=baseline, images={app: dict(
                    repository='registry.test/namespace/' + app, digest=digest(value),
                    buildSourceSha=source * 40, origin='built') for app, value in [('web', web), ('console', console)]})


class PairedDeployTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='paired-deploy-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.runtime, self.config, self.bin = [self.root / name for name in ('runtime', 'config', 'bin')]
        for path in (self.runtime / 'deploy', self.config, self.bin): path.mkdir(parents=True)
        self.state = self.runtime / 'deploy'
        self.file = self.runtime / 'compose.yml'
        self.file.write_text((ROOT / 'ops/oci/compose.yml').read_text())
        self.configuration = '''IMAGE_REPOSITORY=registry.test/namespace/web
CONSOLE_IMAGE_REPOSITORY=registry.test/namespace/console
POSTGRES_NETWORK=fixture-network
DATABASE_HOST=postgres
DATABASE_PORT=5432
DATABASE_NAME=fixture
DATABASE_USER=oioi_app
APP_BIND_ADDRESS=127.0.0.1
APP_PORT=3000
CONSOLE_PORT=3001
SMOKE_PATHS="/ /api/auth/session"
CONSOLE_SMOKE_PATHS="/admin-login"
REQUIRED_RUNTIME_KEYS="DATABASE_URL AUTH_SECRET"
'''
        (self.config / 'deploy.conf').write_text(self.configuration)
        (self.config / 'runtime-public.env').write_text('AUTH_TRUST_HOST=true\n')
        (self.config / 'runtime-secrets.env').write_text('DB_APP_PASSWORD=ocid1.vaultsecret.test.db\nAUTH_SECRET=ocid1.vaultsecret.test.web\n')
        (self.config / 'console-runtime-public.env').write_text('CONSOLE_ORIGIN=http://127.0.0.1:3001\nR2_ENDPOINT=https://account.r2.cloudflarestorage.com\nR2_BUCKET=fixture-albums\nASSETS_PUBLIC_BASE_URL=https://assets.example.test\n')
        (self.config / 'console-runtime-secrets.env').write_text('DB_APP_PASSWORD=ocid1.vaultsecret.test.db\nCONSOLE_AUTH_SECRET=ocid1.vaultsecret.test.auth\nCONSOLE_MFA_ENCRYPTION_KEY=ocid1.vaultsecret.test.mfa\nR2_ACCESS_KEY_ID=ocid1.vaultsecret.test.r2id\nR2_SECRET_ACCESS_KEY=ocid1.vaultsecret.test.r2secret\n')
        (self.bin / 'oci').write_text('''#!/usr/bin/python3
import base64,os,sys
if os.environ.get('MOCK_VAULT_FAIL'): print(''' + repr(SECRET) + ''', file=sys.stderr); sys.exit(1)
key=sys.argv[sys.argv.index('--secret-id')+1].rsplit('.',1)[-1]
values=dict(db='fixture-password',web=os.environ.get('MOCK_WEB_AUTH','fixture-web-secret'),auth=''' + repr(SECRET) + ''',mfa='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',r2id='fixture-r2-id',r2secret='fixture-r2-secret')
print(base64.b64encode(values[key].encode()).decode())
''')
        (self.bin / 'curl').write_text('''#!/usr/bin/python3
import os,sys
if os.environ.get('MOCK_SMOKE_FAIL') and ':3001/' in sys.argv[-1]: print(''' + repr(SECRET) + ''', file=sys.stderr); sys.exit(1)
''')
        (self.bin / 'docker').write_text('''#!/usr/bin/python3
import hashlib,json,os,pathlib,sys
root=pathlib.Path(os.environ['MOCK_ROOT']); args=sys.argv[1:]
with (root/'calls').open('a') as f: f.write(json.dumps(args)+'\\n')
state=root/'containers'; running=json.loads(state.read_text()) if state.exists() else {}
if args[0]=='pull':
    if os.environ.get('MOCK_PULL_FAIL'): print(''' + repr(SECRET) + ''',file=sys.stderr); sys.exit(1)
elif args[:2]==['image','inspect']:
    revisions=json.loads((root/'revisions').read_text()); reference=args[-1]
    print(json.dumps([dict(Architecture='arm64',Config=dict(Labels={'org.opencontainers.image.revision':revisions[reference]}))]))
elif args[0]=='inspect':
    print(json.dumps([next(value for value in running.values() if value['Id']==args[-1])]))
elif args[0]=='compose':
    file=args[args.index('-f')+1]
    operation=args[args.index('-f')+2:]
    if operation[:2]==['config','--quiet']:
        if os.environ.get('MOCK_CONFIG_FAIL'): print(''' + repr(SECRET) + ''',file=sys.stderr); sys.exit(1)
    elif operation[0]=='ps': print(running.get(operation[-1],{}).get('Id',''))
    elif operation[0]=='up':
        apps=['app'] if operation[-1]=='app' else ['web','console']
        for app in apps:
            prefix='APP' if app=='app' else app.upper()
            image=os.environ[prefix+'_IMAGE']; env=pathlib.Path(os.environ[prefix+'_ENV_FILE']).read_text()
            config=hashlib.sha256((image+env+pathlib.Path(file).read_text()+os.environ.get('APP_PORT','')+os.environ.get('CONSOLE_PORT','')).encode()).hexdigest()
            if app not in running or running[app]['Config']['Labels']['com.docker.compose.config-hash']!=config:
                count=int((root/'counter').read_text())+1 if (root/'counter').exists() else 1
                (root/'counter').write_text(str(count))
                running[app]=dict(Id=hex(count)[2:].zfill(64),StartedAt=str(count),Config=dict(Image=image,Labels={'com.docker.compose.config-hash':config}),State=dict(Running=True,Health=dict(Status='healthy')))
            running[app]['State']['Running']=True
            state.write_text(json.dumps(running))
            if os.environ.get('MOCK_FAIL_ALL') or (app==os.environ.get('MOCK_FAIL_APP') and image.endswith(os.environ.get('MOCK_FAIL_DIGEST','impossible'))):
                print(''' + repr(SECRET) + ''',file=sys.stderr); sys.exit(1)
    elif operation[0] in ['stop','rm']:
        for app in operation[1:]:
            if app in running:
                if operation[0]=='rm': running.pop(app)
                else: running[app]['State']['Running']=False
        state.write_text(json.dumps(running))
''')
        for file in self.bin.iterdir(): file.chmod(0o700)
        self.revisions = {}
        self.first = candidate()

    def execute(self, value, **extra):
        for image in value['images'].values(): self.revisions[image['repository'] + '@' + image['digest']] = image['buildSourceSha']
        (self.root / 'revisions').write_text(json.dumps(self.revisions))
        encoded = base64.urlsafe_b64encode(json.dumps(value).encode()).decode().rstrip('=')
        result = subprocess.run(['bash', str(ROOT / 'ops/oci/deploy-release.sh'),
                                 value['images']['web']['digest'], value['images']['console']['digest'], encoded],
                                capture_output=True, text=True, timeout=10, env={**os.environ,
                                    'PATH': str(self.bin) + ':' + os.environ['PATH'], 'MOCK_ROOT': str(self.root),
                                    'M9_DEPLOY_TEST_MODE': '1', 'OIOI_RUNTIME_ROOT': str(self.runtime),
                                    'OIOI_CONFIG_ROOT': str(self.config), 'OIOI_COMPOSE_FILE': str(self.file), **extra})
        self.assertNotIn(SECRET, result.stdout + result.stderr)
        self.assertNotIn('fixture-password', result.stdout + result.stderr)
        return result

    def running(self): return json.loads((self.root / 'containers').read_text())

    def next(self, app='web'):
        self.assertEqual(self.execute(self.first).returncode, 0)
        value = candidate('f', '1' if app=='web' else 'b', '2' if app=='console' else 'c',
                          dict(releaseId=identity(self.first), artifactId=99, runId=31, runAttempt=1))
        other = 'console' if app=='web' else 'web'
        value['images'][other].update(buildSourceSha=self.first['sourceSha'], origin='reused')
        return value

    def test_selective_apply(self):
        value = self.next('web'); before = self.running()
        result = self.execute(value)
        self.assertEqual(result.returncode, 0, result.stderr)
        after = self.running()
        self.assertEqual(before['console'], after['console'])
        self.assertNotEqual(before['web']['Id'], after['web']['Id'])
        self.assertEqual(json.loads((self.state/'previous-pair'/'candidate.json').read_text()), self.first)
        calls = [json.loads(line) for line in (self.root/'calls').read_text().splitlines()]
        self.assertTrue(any(call[-5:] == ['up','-d','--wait','web','console'] for call in calls))
        self.assertFalse(any('down' in call or '--force-recreate' in call for call in calls))

    def test_console_only(self):
        value = self.next('console'); before = self.running()
        self.assertEqual(self.execute(value).returncode, 0)
        self.assertEqual(before['web'], self.running()['web'])
        self.assertNotEqual(before['console']['Id'], self.running()['console']['Id'])

    def test_same_images_and_runtime_configuration_change(self):
        value = self.next(); value['images']['web'] = dict(self.first['images']['web'], origin='reused')
        before = self.running()
        (self.config/'runtime-public.env').write_text('AUTH_TRUST_HOST=true\nR2_BUCKET=new-config\n')
        self.assertEqual(self.execute(value).returncode, 0)
        self.assertNotEqual(before['web']['Id'], self.running()['web']['Id'])
        self.assertEqual(before['console'], self.running()['console'])

    def test_no_changes(self):
        value = self.next(); value['images']['web'] = dict(self.first['images']['web'], origin='reused')
        before = self.running()
        self.assertEqual(self.execute(value).returncode, 0)
        self.assertEqual(before, self.running())

    def test_rejects_changed_baseline_and_missing_evidence(self):
        value = self.next(); before = self.running()
        for baseline in (None, dict(value['baseline'], releaseId='0'*64)):
            value['baseline'] = baseline
            self.assertEqual(self.execute(value).returncode, 1)
            self.assertEqual(before, self.running())
            if baseline is None: value['baseline'] = dict(releaseId=identity(self.first), artifactId=99, runId=31, runAttempt=1)

    def test_preflight_failures_leave_pair_untouched(self):
        value = self.next(); before = self.running(); state = (self.state/'current-pair').readlink()
        for failure in ('MOCK_VAULT_FAIL', 'MOCK_PULL_FAIL', 'MOCK_CONFIG_FAIL'):
            self.assertEqual(self.execute(value, **{failure: '1'}).returncode, 1)
            self.assertEqual(before, self.running())
            self.assertEqual(state, (self.state/'current-pair').readlink())
        self.assertEqual(self.execute(value, MOCK_WEB_AUTH=SECRET).returncode, 1)

    def test_reused_image_substitution_is_rejected(self):
        value = self.next(); before = self.running()
        value['images']['console']['buildSourceSha'] = '0' * 40
        self.assertEqual(self.execute(value).returncode, 1)
        self.assertEqual(before, self.running())

    def test_running_drift_is_rejected(self):
        value = self.next(); running = self.running()
        running['console']['Config']['Image']='attacker/image@'+digest('9')
        (self.root/'containers').write_text(json.dumps(running))
        self.assertEqual(self.execute(value).returncode, 1)
        self.assertFalse((self.state/'pending-pair').exists())

    def test_one_app_failure_restores_pair(self):
        value = self.next('console'); before = self.running()
        result = self.execute(value, MOCK_FAIL_APP='console', MOCK_FAIL_DIGEST=digest('2'))
        self.assertEqual(result.returncode, 20, result.stderr)
        self.assertEqual(self.running()['web'], before['web'])
        self.assertEqual(self.running()['console']['Config'], before['console']['Config'])
        self.assertEqual(json.loads((self.state/'current-pair'/'candidate.json').read_text()), self.first)
        self.assertFalse((self.state/'pending-pair').exists())

    def test_smoke_and_rollback_failure_keeps_pending(self):
        value = self.next()
        result = self.execute(value, MOCK_SMOKE_FAIL='1')
        self.assertEqual(result.returncode, 21, result.stderr)
        self.assertTrue((self.state/'pending-pair').exists())
        self.assertEqual(self.execute(value).returncode, 1)
        self.assertEqual(json.loads((self.state/'current-pair'/'candidate.json').read_text()), self.first)

    def test_rollback_after_web_failure_restores_both_envs_and_compose(self):
        value = self.next('web')
        original = {app: (self.runtime/(app+'.env')).read_bytes() for app in ('web','console')}
        old_compose = self.file.read_bytes()
        public = self.config/'console-runtime-public.env'
        public.write_text(public.read_text().replace('R2_BUCKET=fixture-albums', 'R2_BUCKET=new-config'))
        self.file.write_bytes(old_compose + b'\n# candidate configuration\n')
        result = self.execute(value, MOCK_FAIL_APP='web', MOCK_FAIL_DIGEST=digest('1'))
        self.assertEqual(result.returncode, 20, result.stderr)
        self.assertEqual(self.file.read_bytes(), old_compose)
        for app in ('web','console'):
            self.assertEqual((self.runtime/(app+'.env')).read_bytes(), original[app])

    def test_lock(self):
        import fcntl
        with (self.state/'deployment.lock').open('w') as file:
            fcntl.flock(file, fcntl.LOCK_EX | fcntl.LOCK_NB)
            self.assertEqual(self.execute(self.first).returncode, 1)
        self.assertFalse((self.root/'calls').exists())

    def prepare_legacy(self):
        legacy = self.state/'legacy-host'; legacy.mkdir()
        (legacy/'compose.yml').write_text('name: oioi-bwg-development\nservices:\n  app:\n    image: ${APP_IMAGE}\n')
        (legacy/'deploy.conf').write_text(self.configuration)
        (legacy/'deploy-release.sh').write_text('original-script')
        (self.state/'current').write_text(digest('9'))
        (self.runtime/'app.env').write_text('AUTH_SECRET=legacy-protected\n')
        (self.root/'containers').write_text(json.dumps(dict(app=dict(Id='9'*64,StartedAt='legacy',Config=dict(Image='registry.test/namespace/web@'+digest('9'),Labels={'com.docker.compose.config-hash':'legacy'}),State=dict(Running=True,Health=dict(Status='healthy'))))))
    def test_legacy_success_removes_app_only_after_paired_smoke(self):
        self.prepare_legacy()
        result = self.execute(self.first)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn('app', self.running())
        self.assertTrue((self.state/'current-pair').exists())
        self.assertEqual((self.state/'current').read_text(), digest('9'))

    def test_legacy_failure_restores_web_and_stops_pair(self):
        self.prepare_legacy()
        result = self.execute(self.first, MOCK_FAIL_APP='console', MOCK_FAIL_DIGEST=digest('c'))
        self.assertEqual(result.returncode, 20, result.stderr)
        self.assertTrue(self.running()['app']['State']['Running'])
        self.assertFalse(self.running()['console']['State']['Running'])
        self.assertFalse((self.state/'current-pair').exists())
        self.assertEqual((self.runtime/'app.env').read_text(), 'AUTH_SECRET=legacy-protected\n')

    def test_fresh_failure_stops_both(self):
        self.assertEqual(self.execute(self.first, MOCK_FAIL_APP='console', MOCK_FAIL_DIGEST=digest('c')).returncode, 21)
        self.assertTrue(all(not item['State']['Running'] for item in self.running().values()))
        self.assertFalse((self.state/'current-pair').exists())


if __name__ == '__main__': unittest.main()
