#!/usr/bin/env python3
"""Build one app's temporary raw env; never print Vault values or errors."""
import base64
import os
import re
import subprocess
import sys
from pathlib import Path
from urllib.parse import quote, urlsplit

SECRETS = {
    'web': {'DB_APP_PASSWORD', 'AUTH_SECRET', 'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'},
    'console': {'DB_APP_PASSWORD', 'CONSOLE_AUTH_SECRET', 'CONSOLE_MFA_ENCRYPTION_KEY',
                'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY', 'FIREBASE_SERVICE_ACCOUNT_JSON'},
}
CONSOLE_PUBLIC = {'CONSOLE_ORIGIN', 'CONSOLE_MFA_ENROLLMENT_ENABLED',
                  'R2_ENDPOINT', 'R2_BUCKET', 'ASSETS_PUBLIC_BASE_URL', 'CONSOLE_PUSH_ENABLED',
                  'FIREBASE_PROJECT_ID', 'FIREBASE_API_KEY', 'FIREBASE_APP_ID',
                  'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_VAPID_PUBLIC_KEY'}


def require(condition):
    if not condition:
        raise ValueError('Invalid runtime configuration')


def read_env(path):
    values = {}
    for line in Path(path).read_text(encoding='utf-8').splitlines():
        if not line or line.startswith('#'):
            continue
        require(re.fullmatch(r'[A-Z][A-Z0-9_]*=[^\r\n\x00]*', line))
        key, value = line.split('=', 1)
        require(key not in values)
        values[key] = value
    return values


def materialize(app, public_path, map_path, output):
    require(app in SECRETS)
    public, mapping = read_env(public_path), read_env(map_path)
    require(not (public.keys() & (SECRETS['web'] | SECRETS['console'] | {'DATABASE_URL'})))
    require(mapping.keys() <= SECRETS[app])
    if app == 'web':
        require(not any(key.startswith('CONSOLE_') for key in public))
        required = {'DB_APP_PASSWORD', 'AUTH_SECRET'}
    else:
        require(public.keys() <= CONSOLE_PUBLIC)
        value = public.get('CONSOLE_ORIGIN', '')
        origin = urlsplit(value)
        host = f'[{origin.hostname}]' if ':' in (origin.hostname or '') else origin.hostname
        port = origin.port
        authority = f'{host}:{port}' if port and port != (443 if origin.scheme == 'https' else 80) else host
        require((origin.scheme == 'https' or
                 (origin.scheme == 'http' and origin.hostname in {'127.0.0.1', 'localhost', '::1'}))
                and origin.hostname and re.fullmatch(r'[a-z0-9.:-]+', origin.hostname)
                and not origin.username and not origin.password
                and value in {f'{origin.scheme}://{authority}', f'{origin.scheme}://{authority}/'})
        if port is not None:
            require(0 < port <= 65535)
        public.setdefault('CONSOLE_MFA_ENROLLMENT_ENABLED', 'false')
        require(public['CONSOLE_MFA_ENROLLMENT_ENABLED'] in {'true', 'false'})
        required = {'DB_APP_PASSWORD', 'CONSOLE_AUTH_SECRET', 'CONSOLE_MFA_ENCRYPTION_KEY',
                    'R2_ACCESS_KEY_ID', 'R2_SECRET_ACCESS_KEY'}
        public.setdefault('CONSOLE_PUSH_ENABLED', 'false')
        require(public['CONSOLE_PUSH_ENABLED'] in {'true', 'false'})
        if public['CONSOLE_PUSH_ENABLED'] == 'true':
            required.add('FIREBASE_SERVICE_ACCOUNT_JSON')
            require(all(public.get(name, '').strip() for name in (
                'FIREBASE_PROJECT_ID', 'FIREBASE_API_KEY', 'FIREBASE_APP_ID',
                'FIREBASE_MESSAGING_SENDER_ID', 'FIREBASE_VAPID_PUBLIC_KEY')))
        require(public.get('R2_BUCKET', '').strip())
        for name in ('R2_ENDPOINT', 'ASSETS_PUBLIC_BASE_URL'):
            asset_url = urlsplit(public.get(name, ''))
            require(asset_url.scheme == 'https' and asset_url.hostname and
                    not asset_url.username and not asset_url.password and
                    not asset_url.query and not asset_url.fragment)
    require(required <= mapping.keys())
    require(len(set(mapping.values())) == len(mapping))
    require(all(re.fullmatch(r'ocid1\.vaultsecret\.[a-z0-9.-]+', value) for value in mapping.values()))
    host, port, name, user = (os.environ[key] for key in
                             ('DATABASE_HOST', 'DATABASE_PORT', 'DATABASE_NAME', 'DATABASE_USER'))
    require(re.fullmatch(r'[A-Za-z0-9.-]+', host) and re.fullmatch(r'[0-9]{1,5}', port)
            and 0 < int(port) <= 65535 and re.fullmatch(r'[A-Za-z0-9_-]+', name) and user == 'oioi_app')
    values = dict(public)
    for key, ocid in mapping.items():
        result = subprocess.run(['oci', 'secrets', 'secret-bundle', 'get', '--auth', 'instance_principal',
                                 '--secret-id', ocid, '--stage', 'CURRENT', '--query',
                                 'data."secret-bundle-content".content', '--raw-output'],
                                capture_output=True, check=True, timeout=60)
        value = base64.b64decode(result.stdout.strip(), validate=True).decode('utf-8')
        require(value and not any(character in value for character in '\r\n\x00'))
        values[key] = value
    if app == 'console':
        key = values['CONSOLE_MFA_ENCRYPTION_KEY']
        decoded = base64.b64decode(key, validate=True)
        require(len(decoded) == 32 and base64.b64encode(decoded).decode() == key
                and key != values['CONSOLE_AUTH_SECRET'] and len(values['CONSOLE_AUTH_SECRET'].encode('utf-16-le')) >= 64)
    password = values.pop('DB_APP_PASSWORD')
    values['DATABASE_URL'] = f'postgresql://{user}:{quote(password, safe="")}@{host}:{port}/{name}'
    required_keys = os.environ.get('REQUIRED_RUNTIME_KEYS', '').split()
    require(all(re.fullmatch(r'[A-Z][A-Z0-9_]*', key) and values.get(key) for key in required_keys))
    # The caller owns the protected temporary path and promotes it only after all preflight checks.
    with open(output, 'w', encoding='utf-8', opener=lambda path, flags: os.open(path, flags | os.O_NOFOLLOW, 0o600)) as file:
        os.fchmod(file.fileno(), 0o600)
        file.write(''.join(f'{key}={value}\n' for key, value in values.items()))


if __name__ == '__main__':
    try:
        require(len(sys.argv) == 5)
        materialize(*sys.argv[1:])
    except Exception:
        print('Runtime env materialization failed', file=sys.stderr)
        sys.exit(1)
