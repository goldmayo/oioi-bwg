import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import https from "node:https";
import { createServer } from "node:http";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

import { chromium } from "playwright";

// DB를 사용하지 않는 실제 Next/Auth.js/Caddy/TLS 검증. MFA 로그인 성공 증거가 아니다.
const caddy = process.env.P06_CADDY_BINARY;
assert.ok(caddy, "P06_CADDY_BINARY must select the inspected Caddy 2.6.2 binary");
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "p06-https-"));
const origin = "https://console.example.test:3443";
const secret = "p06-isolated-cookie-fixture-secret-32-chars";
const children = [];
let browser;
const cert = path.join(directory, "cert.pem");
const key = path.join(directory, "key.pem");
execFileSync(
  "openssl",
  [
    "req",
    "-x509",
    "-newkey",
    "rsa:2048",
    "-nodes",
    "-days",
    "1",
    "-subj",
    "/CN=console.example.test",
    "-addext",
    "subjectAltName=DNS:console.example.test",
    "-keyout",
    key,
    "-out",
    cert,
  ],
  { stdio: "ignore" },
);
const pem = fs.readFileSync(cert);
const publicKey = execFileSync("openssl", ["x509", "-in", cert, "-pubkey", "-noout"]);
const der = execFileSync("openssl", ["pkey", "-pubin", "-outform", "der"], { input: publicKey });
const { createHash } = await import("node:crypto");
const pin = createHash("sha256").update(der).digest("base64");
function launch(command, args, env = process.env) {
  const log = fs.openSync(path.join(directory, `${children.length}.log`), "w");
  const child = spawn(command, args, {
    env: { ...env, XDG_CONFIG_HOME: directory, XDG_DATA_HOME: directory },
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  children.push(child);
  return child;
}
async function stop(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, "exit");
  child.kill("SIGTERM");
  await exited;
}
function request(route, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(
      `${origin}${route}`,
      {
        ca: pem,
        family: 4,
        lookup: (_host, _options, callback) => callback(null, "127.0.0.1", 4),
        agent: false,
        ...options,
      },
      (res) => {
        let body = "";
        res.on("data", (part) => (body += part));
        res.on("end", () => resolve({ status: res.statusCode, headers: res.headers, body }));
      },
    );
    req.on("error", reject);
    req.end(options.body);
  });
}
async function ready(probe, child) {
  for (let i = 0; i < 100; i++) {
    assert.equal(child.exitCode, null, `fixture exited; see ${directory}`);
    try {
      if (await probe()) return;
    } catch {
      /* 시작 대기 */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`fixture startup timed out; see ${directory}`);
}
try {
  const base = fs
    .readFileSync("ops/oci/console.Caddyfile", "utf8")
    .replaceAll("console.oioibawige.com", "console.example.test:3443")
    .replace(
      "console.example.test:3443 {",
      `console.example.test:3443 {\n bind 127.0.0.1\n tls ${cert} ${key}`,
    );
  const config = path.join(directory, "Caddyfile");
  fs.writeFileSync(config, `{ admin off\n auto_https off\n }\n${base}`);
  let proxy = launch(caddy, ["run", "--config", config, "--adapter", "caddyfile"]);
  await ready(async () => (await request("/admin-login")).status === 403, proxy);
  assert.equal(
    (await request("/api/auth/csrf", { headers: { "CF-Connecting-IP": "203.0.113.1" } })).status,
    403,
    "public gate precedes proxy even with forged headers",
  );
  await stop(proxy);
  // 이 fixture에서만 loopback을 Cloudflare peer로 모사한다. 실제 CDN 검증으로 기록하지 않는다.
  const fixture = base
    .replace('respond "Console is not public" 403', "")
    .replace(/@cloudflare remote_ip [^\n]+/, "@cloudflare remote_ip 127.0.0.1/32");
  fs.writeFileSync(config, `{ admin off\n auto_https off\n }\n${fixture}`);
  proxy = launch(caddy, ["run", "--config", config, "--adapter", "caddyfile"]);
  await ready(
    async () => (await request("/", { localAddress: "127.0.0.2" })).status === 403,
    proxy,
  );
  const echo = createServer((req, res) => res.end(JSON.stringify(req.headers)));
  await new Promise((resolve) => echo.listen(3001, "127.0.0.1", resolve));
  try {
    for (const ip of ["203.0.113.1", "2001:db8::2"]) {
      const forwarded = JSON.parse(
        (
          await request("/", {
            headers: {
              "CF-Connecting-IP": ip,
              "X-Console-Client-IP": "198.51.100.99",
              "X-Forwarded-For": "198.51.100.99",
              "X-Real-IP": "198.51.100.99",
            },
          })
        ).body,
      );
      assert.equal(forwarded["x-console-client-ip"], ip);
      assert.equal(forwarded["x-forwarded-for"], ip);
      assert.equal(forwarded["cf-connecting-ip"], undefined);
      assert.equal(forwarded["x-real-ip"], undefined);
    }
  } finally {
    await new Promise((resolve) => echo.close(resolve));
  }
  const app = launch(process.execPath, ["apps/console/.next/standalone/apps/console/server.js"], {
    PATH: process.env.PATH,
    NODE_ENV: "production",
    HOSTNAME: "127.0.0.1",
    PORT: "3001",
    CONSOLE_ORIGIN: origin,
    CONSOLE_AUTH_SECRET: secret,
    CONSOLE_MFA_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString("base64"),
    CONSOLE_MFA_ENROLLMENT_ENABLED: "false",
    // DB 접속 없이 검증한다. 서비스 DB 검증은 기존 격리 Postgres runner가 소유한다.
    DATABASE_URL: "postgresql://unused:unused@127.0.0.1:1/unused",
  });
  await ready(async () => (await request("/healthz")).status === 200, app);
  const csrfResponse = await request("/api/auth/csrf", {
    headers: { "X-Forwarded-Host": "evil.test", "X-Forwarded-Proto": "http" },
  });
  assert.equal(csrfResponse.status, 200, "Caddy overwrites forged authority");
  assert.match(csrfResponse.headers["cache-control"], /(?:^|,\s*)no-store(?:,|$)/);
  assert.equal(csrfResponse.headers["cloudflare-cdn-cache-control"], "no-store");
  for (const cookie of csrfResponse.headers["set-cookie"]) {
    assert.match(cookie, /; Secure/i);
    assert.match(cookie, /; HttpOnly/i);
    assert.match(cookie, /; SameSite=Lax/i);
    assert.doesNotMatch(cookie, /; Domain=/i);
  }
  assert.equal(
    (
      await request("/api/auth/csrf", {
        localAddress: "127.0.0.2",
        headers: { "CF-Connecting-IP": "203.0.113.1", "X-Forwarded-For": "127.0.0.1" },
      })
    ).status,
    403,
  );
  const direct = await fetch("http://127.0.0.1:3001/api/auth/csrf", {
    headers: { host: "evil.test" },
  });
  assert.equal(direct.status, 403, "direct forged Host is rejected by Auth route");
  browser = await chromium.launch({
    args: [
      `--ignore-certificate-errors-spki-list=${pin}`,
      "--host-resolver-rules=MAP *.example.test 127.0.0.1",
    ],
  });
  // 이 임시 키만 신뢰한다. 전체 인증서 검증을 끄지 않는다.
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${origin}/admin-login`);
  await page.getByLabel("Email").waitFor();
  const browserCsrf = await page.evaluate(async () => (await fetch("/api/auth/csrf")).json());
  const require = createRequire(new URL("../../apps/console/package.json", import.meta.url));
  const { encode } = await import(require.resolve("next-auth/jwt"));
  const token = await encode({
    token: { sub: "fixture", mfaVerified: true, mfaVersion: 1 },
    secret,
    salt: "oioi-console.session-token",
  });
  await context.addCookies([
    {
      name: "oioi-console.session-token",
      value: token,
      url: origin,
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
  const renewal = page.waitForResponse((response) => response.url().endsWith("/api/auth/session"));
  await page.evaluate(() => fetch("/api/auth/session"));
  const renewed = await renewal;
  assert.equal(renewed.status(), 200);
  assert.match(await renewed.headerValue("set-cookie"), /oioi-console.session-token=.*;.*Secure/);
  for (const cookie of await context.cookies()) {
    assert.ok(cookie.secure && cookie.httpOnly);
    assert.equal(cookie.sameSite, "Lax");
    assert.equal(cookie.domain, "console.example.test");
  }
  assert.deepEqual(
    await context.cookies("https://web.example.test:3443"),
    [],
    "host-only cookies do not reach sibling Web host",
  );
  const cookie = (await context.cookies()).map((item) => `${item.name}=${item.value}`).join("; ");
  for (const route of [
    "/api/auth/callback/credentials",
    "/api/auth/signout",
    "/api/auth/mfa/setup",
    "/api/auth/mfa/confirm",
    "/api/admin/albums",
  ]) {
    assert.equal(
      (
        await request(route, {
          method: "POST",
          headers: {
            Origin: "https://evil.test",
            Cookie: cookie,
            "Content-Type": "application/json",
          },
          body: "{}",
        })
      ).status,
      403,
    );
  }
  const manifest = JSON.parse(
    fs.readFileSync(
      "apps/console/.next/standalone/apps/console/.next/server/server-reference-manifest.json",
      "utf8",
    ),
  );
  const actionId = Object.entries(manifest.node).find(
    ([, value]) => value.exportedName === "signIn",
  )?.[0];
  assert.ok(actionId);
  const boundary = "p06-flight-boundary";
  const flight = `--${boundary}\r\nContent-Disposition: form-data; name="0"\r\n\r\n["$K1"]\r\n--${boundary}--\r\n`;
  for (const suppliedOrigin of [undefined, "https://evil.test"]) {
    const denied = await request("/admin-login", {
      method: "POST",
      headers: {
        "Next-Action": actionId,
        Accept: "text/x-component",
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        ...(suppliedOrigin ? { Origin: suppliedOrigin, "X-Forwarded-Host": "evil.test" } : {}),
      },
      body: flight,
    });
    if (suppliedOrigin) assert.ok(denied.status >= 400);
    else assert.ok(denied.body.includes("요청 출처를 확인할 수 없습니다."));
  }
  const badCsrf = await request("/api/auth/signout", {
    method: "POST",
    headers: {
      Origin: origin,
      Cookie: cookie,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "csrfToken=bad",
  });
  assert.match(badCsrf.headers.location, /MissingCSRF/);
  const logoutResponse = page.waitForResponse(
    (response) =>
      response.request().method() === "POST" && response.url().endsWith("/api/auth/signout"),
  );
  await page.evaluate(async (csrfToken) => {
    await fetch("/api/auth/signout", {
      method: "POST",
      body: new URLSearchParams({ csrfToken, callbackUrl: "https://evil.test" }),
    });
  }, browserCsrf.csrfToken);
  const logout = await logoutResponse;
  assert.equal(new URL(await logout.headerValue("location")).origin, origin);
  assert.ok(!(await context.cookies()).some((item) => item.name === "oioi-console.session-token"));
  console.log(
    "Isolated HTTPS passed: Caddy closed gate/peer rejection/header overwrite/cache, Auth.js cookie renewal/CSRF/logout/redirect and browser host-only scope. DB/MFA login and real Cloudflare remain unverified.",
  );
} finally {
  if (browser) await browser.close();
  for (const child of children.reverse()) await stop(child);
  if (process.env.P06_KEEP_ARTIFACTS !== "true")
    fs.rmSync(directory, { recursive: true, force: true });
}
