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
     const store = '/app/node_modules/.pnpm';
     const packages = readdirSync(store).filter(name => name.startsWith('argon2@'));
     if (packages.length !== 1) throw new Error('Expected one traced Argon2 package');
     const argon2 = require(store + '/' + packages[0] + '/node_modules/argon2');
     (async () => {
       const hash = await argon2.hash('container-native-test-only');
       if (!await argon2.verify(hash, 'container-native-test-only')) process.exit(1);
     })().catch(() => process.exit(1));`,
  ],
  { stdio: "inherit" },
);
console.log(`${app} container native smoke passed`);
