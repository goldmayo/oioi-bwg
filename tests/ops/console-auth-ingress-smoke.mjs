import assert from "node:assert/strict";
import fs from "node:fs";

import { loginConsole, nextConsoleOtp } from "./console-mfa-smoke.mjs";

const password = "P04-fixture-pass1!";
const consoleStandaloneDirectory = "apps/console/.next/standalone/apps/console";
const manifest = JSON.parse(
  fs.readFileSync(
    `${consoleStandaloneDirectory}/.next/server/server-reference-manifest.json`,
    "utf8",
  ),
);
function actionId(name) {
  const match = Object.entries(manifest.node).find(([, entry]) => entry.exportedName === name);
  assert.ok(match, `built Action ${name} must exist`);
  return match[0];
}
async function action(
  context,
  origin,
  name,
  suppliedOrigin,
  multipart = { 0: "[]" },
  route = "/admin-login",
) {
  return context.request.post(`${origin}${route}`, {
    headers: {
      "Next-Action": actionId(name),
      Accept: "text/x-component",
      ...(suppliedOrigin === undefined ? {} : { Origin: suppliedOrigin }),
    },
    multipart,
    maxRedirects: 0,
  });
}
async function callback(context, origin, email, csrfToken, extraHeaders = {}) {
  return context.request.post(`${origin}/api/auth/callback/credentials`, {
    headers: { Origin: origin, ...extraHeaders },
    form: { csrfToken, email, password, otp: "000000", callbackUrl: `${origin}/admin/albums` },
    maxRedirects: 0,
  });
}
const sessionCookie = (cookies) => cookies.find((c) => c.name === "oioi-console.session-token");

export async function assertConsoleAuthIngress(browser, origin, sql, artifacts) {
  const context = await browser.newContext();
  await loginConsole(context, origin, sql);
  const original = sessionCookie(await context.cookies());
  const { csrfToken } = await (await context.request.get(`${origin}/api/auth/csrf`)).json();
  const adminStatus = async () => (await context.request.get(`${origin}/api/admin/songs`)).status();
  assert.equal(await adminStatus(), 200);

  // 유효 JWT/CSRF를 보유해도 다른 Origin은 mutation을 실행할 수 없다.
  for (const suppliedOrigin of [undefined, "null", "http://127.0.0.1:3200", "https://evil.test"]) {
    const headers = suppliedOrigin === undefined ? {} : { Origin: suppliedOrigin };
    for (const [method, route] of [
      ["POST", "/api/admin/albums"],
      ["PATCH", "/api/admin/albums/1"],
      ["DELETE", "/api/admin/albums/1"],
      ["POST", "/api/admin/songs"],
      ["PATCH", "/api/admin/songs/1"],
      ["DELETE", "/api/admin/songs/1"],
      ["PATCH", "/api/admin/songs/1/lyrics"],
      ["POST", "/api/auth/callback/credentials"],
      ["POST", "/api/auth/signout"],
      ["POST", "/api/auth/session"],
    ]) {
      const response = await context.request.fetch(`${origin}${route}`, {
        method,
        headers,
        data: { csrfToken },
        maxRedirects: 0,
      });
      assert.equal(response.status(), 403, `${method} ${route}: configured Origin required`);
      assert.equal((await response.json()).code, "FORBIDDEN");
    }
    // 실제 빌드된 Action ID/React Flight 전송으로 Next 및 configured Origin 경계를 검사한다.
    const denied = await action(
      context,
      origin,
      "uploadAlbumImageAction",
      suppliedOrigin,
      { 0: '["$K1"]' },
      "/admin/albums",
    );
    if (suppliedOrigin === undefined)
      assert.ok((await denied.text()).includes("이미지 업로드에 실패했습니다."));
    else assert.ok(denied.status() >= 400);
    const deniedLogin = await action(context, origin, "signIn", suppliedOrigin, { 0: '["$K1"]' });
    if (suppliedOrigin === undefined)
      assert.ok((await deniedLogin.text()).includes("요청 출처를 확인할 수 없습니다."));
    else assert.ok(deniedLogin.status() >= 400);
    await action(context, origin, "signOut", suppliedOrigin);
    assert.equal(await adminStatus(), 200, "invalid Origin must not sign out");
  }
  const validUpload = await action(
    context,
    origin,
    "uploadAlbumImageAction",
    origin,
    { 0: '["$K1"]' },
    "/admin/albums",
  );
  assert.ok(
    (await validUpload.text()).includes("파일이 없습니다."),
    "same-origin upload reaches core validation without R2",
  );
  for (const contentType of ["text/plain", "application/x-www-form-urlencoded"]) {
    const response = await context.request.post(`${origin}/api/admin/albums`, {
      headers: { Origin: origin, "Content-Type": contentType },
      data: "{}",
    });
    assert.equal(response.status(), 400);
  }
  const missingCsrf = await callback(context, origin, "unregistered@p04.example.test", "invalid");
  assert.equal(missingCsrf.status(), 302);
  assert.equal(new URL(missingCsrf.headers().location).searchParams.get("error"), "MissingCSRF");
  await context.request.post(`${origin}/api/auth/signout`, {
    headers: { Origin: origin },
    form: { csrfToken: "invalid" },
    maxRedirects: 0,
  });
  await context.request.get(`${origin}/api/auth/signout`);
  assert.equal(sessionCookie(await context.cookies()).value, original.value);
  assert.equal(await adminStatus(), 200, "bad CSRF and GET must not sign out");

  const httpLogout = await browser.newContext();
  await httpLogout.addCookies(await context.cookies());
  const loggedOut = await httpLogout.request.post(`${origin}/api/auth/signout`, {
    headers: { Origin: origin },
    form: { csrfToken },
    maxRedirects: 0,
  });
  assert.equal(loggedOut.status(), 302);
  assert.equal(sessionCookie(await httpLogout.cookies()), undefined);
  assert.equal((await httpLogout.request.get(`${origin}/api/admin/songs`)).status(), 401);
  await httpLogout.close();

  const page = await context.newPage();
  await page.goto(`${origin}/admin/albums`);
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByTitle("로그아웃", { exact: true }).click();
  await page.waitForURL(`${origin}/admin-login`);
  assert.equal(sessionCookie(await context.cookies()), undefined);
  await context.close();

  // 아직 OTP UI가 없는 C2에서는 실제 폼이 보내는 Flight payload를 관찰한 뒤 OTP 필드만 보완한다.
  const attempts = await browser.newContext();
  const loginPage = await attempts.newPage();
  await loginPage.goto(`${origin}/admin-login`);
  await loginPage.getByLabel("Email").fill("rate-action@p04.example.test");
  await loginPage.getByLabel("Password").fill(password);
  const emitted = loginPage.waitForRequest(
    (r) => r.method() === "POST" && Boolean(r.headers()["next-action"]),
  );
  await loginPage.getByRole("button", { name: "로그인", exact: true }).click();
  const request = await emitted;
  assert.equal(request.headers()["next-action"], actionId("signIn"));
  const fields = await new Request(request.url(), {
    method: "POST",
    headers: request.headers(),
    body: request.postDataBuffer(),
  }).formData();
  const emailField = [...fields.keys()].find((key) => key.endsWith("_email"));
  assert.ok(emailField);
  const root = fields.get("0");
  fields.delete("0");
  fields.set(`${emailField.slice(0, -5)}otp`, "000000");
  // Flight의 root를 마지막에 보낸다. plain object는 숫자 key 0을 앞에 옮겨 FormData가 비게 된다.
  fields.append("0", root);
  const multipart = fields;
  await loginPage.getByText("이메일 또는 비밀번호를 확인해주세요.", { exact: true }).waitFor();
  const positive = await browser.newContext();
  const positiveFields = new FormData();
  for (const [name, value] of fields) positiveFields.append(name, value);
  positiveFields.set(emailField, "admin@p04.example.test");
  positiveFields.set(`${emailField.slice(0, -5)}otp`, await nextConsoleOtp(sql));
  const signedIn = await action(positive, origin, "signIn", origin, positiveFields);
  const actionRedirect = signedIn.headers()["x-action-redirect"];
  assert.ok(
    actionRedirect,
    `successful Action redirect: HTTP ${signedIn.status()}, cookie=${Boolean(sessionCookie(await positive.cookies()))}`,
  );
  const target = new URL(actionRedirect.split(";")[0], origin);
  assert.equal(target.origin, origin);
  assert.equal(target.pathname, "/admin");
  assert.ok(sessionCookie(await positive.cookies()));
  assert.equal((await positive.request.get(`${origin}/api/admin/songs`)).status(), 200);
  await positive.close();
  const beforeLimits = fs
    .readFileSync(`${artifacts}/console.log`, "utf8")
    .split('"event":"auth.failure"').length;
  for (let i = 0; i < 5; i++) {
    const response = await action(attempts, origin, "signIn", origin, multipart);
    assert.ok((await response.text()).includes("이메일 또는 비밀번호를 확인해주세요."));
  }
  const limitedAction = await action(attempts, origin, "signIn", origin, multipart);
  const limitedBody = await limitedAction.text();
  assert.ok(
    limitedBody.includes('"code":"RATE_LIMITED"'),
    `Action limit response: HTTP ${limitedAction.status()}, credentials=${limitedBody.includes("이메일 또는 비밀번호를 확인해주세요.")}`,
  );
  assert.ok(
    !limitedBody.includes(password) && !limitedBody.includes("rate-action@p04.example.test"),
  );
  const wait = limitedBody.match(/"retryAfterSeconds":(\d+)/);
  assert.ok(wait && Number(wait[1]) > 0 && Number(wait[1]) <= 300);
  const token = await (await attempts.request.get(`${origin}/api/auth/csrf`)).json();
  const bypass = await callback(attempts, origin, "rate-action@p04.example.test", token.csrfToken, {
    "X-Forwarded-For": "203.0.113.1",
    "X-Real-IP": "203.0.113.2",
  });
  assert.equal(bypass.status(), 302);
  assert.ok(
    bypass.headers().location.includes("code=rate_limited"),
    "Action and direct callback share the limiter",
  );
  assert.equal(sessionCookie(await attempts.cookies()), undefined);

  const concurrent = await Promise.all(
    Array.from({ length: 6 }, () =>
      callback(attempts, origin, "rate-concurrent@p04.example.test", token.csrfToken),
    ),
  );
  assert.equal(
    concurrent.filter((r) => r.headers().location.includes("code=credentials")).length,
    5,
  );
  assert.equal(
    concurrent.filter((r) => r.headers().location.includes("code=rate_limited")).length,
    1,
  );
  let ipLimited = false;
  for (let i = 0; i <= 20; i++) {
    const result = await callback(
      attempts,
      origin,
      `rate-ip-${i}@p04.example.test`,
      token.csrfToken,
      { "X-Forwarded-For": `203.0.113.${i + 3}` },
    );
    if (result.headers().location.includes("code=rate_limited")) {
      ipLimited = true;
      break;
    }
  }
  assert.ok(ipLimited, "unknown IP fallback cannot be skipped by changing accounts/XFF");
  const spoofed = await callback(attempts, origin, "rate-spoof@p04.example.test", token.csrfToken, {
    "X-Real-IP": "198.51.100.1",
    "X-Forwarded-For": "198.51.100.2",
  });
  assert.ok(spoofed.headers().location.includes("code=rate_limited"));
  assert.equal(sessionCookie(await attempts.cookies()), undefined);
  const afterLimits = fs
    .readFileSync(`${artifacts}/console.log`, "utf8")
    .split('"event":"auth.failure"').length;
  assert.equal(
    afterLimits,
    beforeLimits,
    "CredentialsSignin and rate limit must not emit AUTH_FAILURE",
  );
  await attempts.close();
  console.log(
    "Console C2 passed: actual Actions/callback shared limits, concurrent reservations, unknown IP fallback, mutation Origin, Auth.js CSRF and both logout paths",
  );
}
