import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";

const run = promisify(execFile);
const fixtureEmail = "admin@p04.example.test";
const authSecret = "p04-console-private-browser-fixture-secret";
export const fixtureKey = Buffer.alloc(32, 9).toString("base64");
const consoleRequire = createRequire(new URL("../../apps/console/package.json", import.meta.url));
const { encode, decode } = await import(consoleRequire.resolve("next-auth/jwt"));
const { generateSync } = createRequire(
  new URL("../../packages/server/package.json", import.meta.url),
)("otplib");
let pending;
const sensitiveValues = [fixtureKey, authSecret, "P04-fixture-pass1!"];

export async function enrollConsoleFixture() {
  const { stdout } = await run(process.execPath, [
    "--conditions=react-server",
    "--import",
    "tsx",
    "tests/ops/console-mfa-fixture.ts",
    fixtureEmail,
  ]);
  pending = JSON.parse(stdout);
  sensitiveValues.push(pending.secret);
}

export async function nextConsoleOtp(sql) {
  const [row] =
    await sql`select last_used_step from admin_mfa where account_id=(select account_id from password_credential where email=${fixtureEmail})`;
  const step = Math.max(Math.floor(Date.now() / 30_000), Number(row.last_used_step) + 1);
  while (step > Math.floor(Date.now() / 30_000) + 1)
    await new Promise((resolve) => setTimeout(resolve, 100));
  const otp = generateSync({ secret: pending.secret, epoch: step * 30 });
  sensitiveValues.push(otp);
  return otp;
}

export async function loginConsole(
  context,
  origin,
  sql,
  email = fixtureEmail,
  expectedSuccess = true,
) {
  const otp = email === fixtureEmail ? await nextConsoleOtp(sql) : "000000";
  const { csrfToken } = await (await context.request.get(`${origin}/api/auth/csrf`)).json();
  const response = await context.request.post(`${origin}/api/auth/callback/credentials`, {
    headers: { Origin: origin },
    form: {
      csrfToken,
      email,
      password: "P04-fixture-pass1!",
      otp,
      callbackUrl: `${origin}/admin/albums`,
    },
    maxRedirects: 0,
  });
  assert.equal(response.status(), 302);
  assert.equal(
    !response.headers().location.includes("error="),
    expectedSuccess,
    "MFA fixture login result",
  );
  return otp;
}

export async function changeConsoleAccess(
  sql,
  role,
  status = "ACTIVE",
  reset = false,
  email = fixtureEmail,
) {
  const [current] =
    await sql`select a.id,a.role,a.status,m.version from account a join admin_mfa m on m.account_id=a.id where a.id=(select account_id from password_credential where email=${email})`;
  const [server] =
    await sql`select extract(epoch from pg_postmaster_start_time())::text as started`;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "p05c-cli-"));
  try {
    const config = path.join(directory, "operator.json");
    const reason = path.join(directory, "reason.txt");
    fs.writeFileSync(
      config,
      JSON.stringify({
        scope: "local-compose",
        operatorUid: process.getuid(),
        databaseUrl: process.env.DATABASE_URL,
        serverStartedAt: server.started,
      }),
      { mode: 0o600 },
    );
    fs.writeFileSync(reason, "격리 세션 회수 검증", { mode: 0o600 });
    const args = [
      "--silent",
      "console:mfa",
      reset ? "mfa-reset" : "account-access",
      "--config",
      config,
      "--account-id",
      String(current.id),
      "--expected-version",
      String(current.version),
      "--reason-file",
      reason,
      "--apply",
    ];
    if (!reset)
      args.push(
        "--expected-role",
        current.role,
        "--expected-status",
        current.status,
        "--role",
        role,
        "--status",
        status,
      );
    const { stdout } = await run("pnpm", args);
    assert.equal(JSON.parse(stdout).version, current.version + 1);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

export async function assertConsoleSessionBoundary(browser, origin, sql) {
  const [account] =
    await sql`select account_id as id from password_credential where email=${fixtureEmail}`;
  const [mfa] = await sql`select version from admin_mfa where account_id=${account.id}`;
  const legacy = await browser.newContext();
  for (const token of [
    { sub: String(account.id) },
    { sub: String(account.id), mfaVerified: true, mfaVersion: mfa.version, expired: true },
  ]) {
    const encoded = await encode({
      token,
      secret: authSecret,
      salt: "oioi-console.session-token",
      maxAge: token.expired ? -60 : 3600,
    });
    await legacy.addCookies([
      { name: "oioi-console.session-token", value: encoded, domain: "127.0.0.1", path: "/" },
    ]);
    assert.equal((await legacy.request.get(`${origin}/api/admin/songs`)).status(), 401);
    if (!token.expired) {
      const { csrfToken } = await (await legacy.request.get(`${origin}/api/auth/csrf`)).json();
      await legacy.request.post(`${origin}/api/auth/session`, {
        headers: { Origin: origin },
        data: {
          csrfToken,
          data: {
            user: { id: String(account.id), mfaVerified: true, mfaVersion: mfa.version },
          },
        },
      });
      assert.equal(
        (await legacy.request.get(`${origin}/api/admin/songs`)).status(),
        401,
        "client update cannot upgrade password-only JWT",
      );
    }
    await legacy.clearCookies();
  }
  await legacy.close();
  const context = await browser.newContext();
  const { csrfToken } = await (await context.request.get(`${origin}/api/auth/csrf`)).json();
  const rejected = await context.request.post(`${origin}/api/auth/callback/credentials`, {
    form: { csrfToken, email: fixtureEmail, password: "P04-fixture-pass1!" },
    headers: { Origin: origin },
    maxRedirects: 0,
  });
  assert.ok(rejected.headers().location.includes("error=CredentialsSignin"));
  assert.equal((await context.request.get(`${origin}/api/admin/songs`)).status(), 401);
  const otp = await loginConsole(context, origin, sql);
  const original = (await (await context.request.get(`${origin}/api/auth/session`)).json()).user;
  assert.deepEqual(original, {
    id: String(account.id),
    mfaVerified: true,
    mfaVersion: mfa.version,
  });
  const cookie = (await context.cookies()).find((c) => c.name === "oioi-console.session-token");
  const jwt = await decode({ token: cookie.value, secret: authSecret, salt: cookie.name });
  assert.deepEqual(
    Object.keys(jwt).sort(),
    ["sub", "mfaVerified", "mfaVersion", "iat", "exp", "jti"].sort(),
  );
  assert.equal(jwt.exp - jwt.iat, 8 * 60 * 60);
  const updated = await context.request.post(`${origin}/api/auth/session`, {
    headers: { Origin: origin },
    data: {
      csrfToken,
      data: { user: { id: "999999", mfaVerified: true, mfaVersion: 999999 }, mfaVersion: 999999 },
    },
  });
  assert.deepEqual((await updated.json()).user, original);
  assert.equal((await context.request.get(`${origin}/api/admin/songs`)).status(), 200);
  const replay = await browser.newContext();
  const replayCsrf = await (await replay.request.get(`${origin}/api/auth/csrf`)).json();
  const rejectedReplay = await replay.request.post(`${origin}/api/auth/callback/credentials`, {
    form: {
      csrfToken: replayCsrf.csrfToken,
      email: fixtureEmail,
      password: "P04-fixture-pass1!",
      otp,
    },
    headers: { Origin: origin },
    maxRedirects: 0,
  });
  assert.ok(rejectedReplay.headers().location.includes("error=CredentialsSignin"));
  assert.equal((await replay.request.get(`${origin}/api/admin/songs`)).status(), 401);
  await replay.close();
  const contexts = [context];
  let current = context;
  for (const [role, status] of [
    ["USER", "ACTIVE"],
    ["ADMIN", "SUSPENDED"],
  ]) {
    await changeConsoleAccess(sql, role, status);
    assert.equal((await current.request.get(`${origin}/api/admin/songs`)).status(), 401);
    await changeConsoleAccess(sql, "ADMIN", "ACTIVE");
    assert.equal(
      (await current.request.get(`${origin}/api/admin/songs`)).status(),
      401,
      "old JWT must stay revoked after restoration",
    );
    current = await browser.newContext();
    contexts.push(current);
    await loginConsole(current, origin, sql);
    assert.equal((await current.request.get(`${origin}/api/admin/songs`)).status(), 200);
  }
  await changeConsoleAccess(sql, "ADMIN", "ACTIVE", true);
  assert.equal(
    (await current.request.get(`${origin}/api/admin/songs`)).status(),
    401,
    "reset must revoke a previously valid JWT",
  );
  await enrollConsoleFixture();
  assert.equal(
    (await current.request.get(`${origin}/api/admin/songs`)).status(),
    401,
    "reset/re-enrollment must not restore old JWT",
  );
  await current.clearCookies();
  await loginConsole(current, origin, sql);
  assert.equal((await current.request.get(`${origin}/api/admin/songs`)).status(), 200);
  for (const item of contexts) await item.close();
}

export function assertConsoleLogsSafe(artifacts, additionalValues = []) {
  for (const app of ["web", "console"]) {
    const output = fs.readFileSync(path.join(artifacts, `${app}.log`), "utf8");
    for (const value of [...sensitiveValues, ...additionalValues])
      assert.ok(
        !output.includes(value),
        "runtime log must not contain fixture credentials, OTP, secret or key",
      );
  }
}
