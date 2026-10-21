import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";

const [image, app] = process.argv.slice(2);
assert.ok(image && ["web", "console"].includes(app));
// 런타임 이미지의 추적된 native 모듈을 실제 로드/실행한다. 키나 DB 입력은 전달하지 않는다.
execFileSync(
  "docker",
  [
    "run",
    "--rm",
    "--entrypoint",
    "node",
    image,
    "-e",
    `const { readdirSync } = require('node:fs');
     const { createRequire } = require('node:module');
     const appRequire = createRequire('/app/apps/${app}/server.js');
     const next = appRequire('next/package.json');
     const nextRequire = createRequire(appRequire.resolve('next/package.json'));
     const sharp = nextRequire('sharp');
     const [major, minor, patch] = sharp.versions.sharp.split('.').map(Number);
     if (!(major > 0 || minor > 35 || (minor === 35 && patch >= 5)))
       throw new Error('Next image runtime requires sharp >= 0.35.5');
     console.log(JSON.stringify({ app: '${app}', next: next.version, sharp: sharp.versions.sharp }));
     (async () => {
       const { info } = await sharp({
         create: { width: 2, height: 2, channels: 3, background: 'white' },
       }).png().toBuffer({ resolveWithObject: true });
       if (info.width !== 2 || info.height !== 2) throw new Error('Sharp native output mismatch');
       // 공개 Web은 비밀번호 인증을 제공하지 않아 Argon2를 추적하지 않는다.
       if ('${app}' === 'console') {
         const store = '/app/node_modules/.pnpm';
         const packages = readdirSync(store).filter(name => name.startsWith('argon2@'));
         if (packages.length !== 1) throw new Error('Expected one traced Argon2 package');
         const argon2 = require(store + '/' + packages[0] + '/node_modules/argon2');
         const hash = await argon2.hash('container-native-test-only');
         if (!await argon2.verify(hash, 'container-native-test-only'))
           throw new Error('Argon2 native verification failed');
       }
     })().catch((error) => { console.error(error); process.exit(1); });`,
  ],
  { stdio: "inherit" },
);
console.log(`${app} container native smoke passed`);
