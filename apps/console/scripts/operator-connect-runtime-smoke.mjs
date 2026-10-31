import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(await readFile(join(app, ".next/prerender-manifest.json"), "utf8"));
assert.equal(
  manifest.routes["/operator-connect"],
  undefined,
  "승인 화면은 요청 시점에 평가해야 합니다.",
);
const results = [];
for (const enabled of [false, true]) {
  const socket = createServer();
  await new Promise((resolve) => socket.listen(0, "127.0.0.1", resolve));
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  // 개인 env를 상속하지 않는다. DB·R2·MFA credential 없이 guest 경계만 검사한다.
  const child = spawn(process.execPath, [join(app, ".next/standalone/apps/console/server.js")], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      NEXT_PUBLIC_APP_ENV: "local",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      CONSOLE_ORIGIN: origin,
      CONSOLE_AUTH_SECRET: "operator-runtime-smoke-public-fixture-only-32-chars",
      CONSOLE_OPERATOR_ENABLED: String(enabled),
    },
    stdio: "ignore",
  });
  const exited = new Promise((resolve) => child.once("exit", resolve));
  try {
    let response;
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) throw new Error("로컬 Console 검증 서버가 조기 종료했습니다.");
      try {
        response = await fetch(origin + "/operator-connect", {
          redirect: "manual",
          signal: AbortSignal.timeout(2000),
        });
        break;
      } catch {
        await delay(100);
      }
    }
    assert.ok(response, "로컬 Console 검증 서버 시작 시간 초과");
    assert.equal(response.status, enabled ? 307 : 404);
    if (enabled) {
      assert.equal(
        new URL(response.headers.get("location"), origin).href,
        origin + "/admin-login?next=operator",
      );
      const login = await fetch(origin + "/admin-login?next=operator");
      assert.equal(login.status, 200);
      assert.match(await login.text(), /관리자 계정으로 로그인/);
    }
    results.push({ enabled, status: response.status });
    await response.arrayBuffer();
  } finally {
    child.kill("SIGTERM");
    await Promise.race([exited, delay(3000)]);
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      await exited;
    }
  }
}
console.log(JSON.stringify(results));
