import assert from "node:assert/strict";
import { createDecipheriv } from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import jsQR from "jsqr";
import { PNG } from "pngjs";

import { changeConsoleAccess, fixtureKey } from "./console-mfa-smoke.mjs";

const { generateSync } = createRequire(
  new URL("../../packages/server/package.json", import.meta.url),
)("otplib");
const password = "P04-fixture-pass1!";
const sessionCookie = (cookies) => cookies.find((c) => c.name === "oioi-console.session-token");
function scan(qrDataUrl) {
  assert.ok(qrDataUrl.startsWith("data:image/png;base64,"), "setup returns a PNG QR");
  const png = PNG.sync.read(Buffer.from(qrDataUrl.split(",")[1], "base64"));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(decoded, "generated PNG must be scannable");
  const uri = new URL(decoded.data);
  assert.equal(uri.protocol, "otpauth:");
  assert.equal(uri.hostname, "totp");
  for (const [name, value] of Object.entries({
    issuer: "oioi-bwg Console",
    algorithm: "SHA1",
    digits: "6",
    period: "30",
  }))
    assert.ok(uri.searchParams.get(name) === value, "authenticator parameters must match B1");
  return { secret: uri.searchParams.get("secret"), uri: uri.href };
}
async function post(context, origin, operation, data, headers = { Origin: origin }) {
  const response = await context.request.post(`${origin}/api/auth/mfa/${operation}`, {
    headers,
    data,
  });
  assert.equal(response.headers()["cache-control"], "no-store");
  assert.equal(response.headers()["set-cookie"], undefined);
  return response;
}
export async function assertEnrollmentClosed(browser, origin) {
  const context = await browser.newContext();
  for (const operation of ["setup", "confirm"]) {
    const response = await post(context, origin, operation, {
      email: "enroll-ui@p04.example.test",
      password,
      otp: "123456",
      version: 1,
    });
    assert.equal(response.status(), 403, "default closed registration must reject both endpoints");
  }
  const page = await context.newPage();
  await page.goto(`${origin}/admin-login`);
  await page.getByLabel("Email").waitFor();
  assert.equal(await page.getByRole("button", { name: "인증기 등록", exact: true }).count(), 0);
  await context.close();
}
export async function assertConsoleEnrollment(browser, origin, sql, artifacts) {
  const context = await browser.newContext();
  const secrets = [];
  const email = "enroll-concurrent@p04.example.test";
  const setup = () => post(context, origin, "setup", { email, password });
  const responses = await Promise.all([setup(), setup()]);
  for (const response of responses) assert.equal(response.status(), 200);
  const pending = await Promise.all(responses.map((response) => response.json()));
  const first = scan(pending[0].qrDataUrl),
    second = scan(pending[1].qrDataUrl);
  assert.ok(first.secret === second.secret, "concurrent QR secrets must converge");
  assert.equal(pending[0].version, pending[1].version);
  const [stored] =
    await sql`select m.* from admin_mfa m join password_credential c on c.account_id=m.account_id where c.email=${email}`;
  const [format, nonce, tag, ciphertext] = stored.encrypted_secret.split(".");
  assert.equal(format, "v1");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(fixtureKey, "base64"),
    Buffer.from(nonce, "base64url"),
  );
  decipher.setAAD(Buffer.from(`oioi-bwg:console-mfa:v1:${stored.account_id}`));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const dbSecret = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString();
  assert.ok(first.secret === dbSecret, "QR uses the actual stored pending secret");
  assert.equal(pending[0].version, stored.version);
  assert.equal(stored.enabled_at, null);
  assert.equal(sessionCookie(await context.cookies()), undefined);
  assert.equal((await context.request.get(`${origin}/api/admin/songs`)).status(), 401);
  const otp = generateSync({ secret: first.secret });
  const confirms = await Promise.all(
    [0, 1].map(() =>
      post(context, origin, "confirm", { email, password, otp, version: stored.version }),
    ),
  );
  assert.deepEqual(confirms.map((response) => response.status()).sort(), [200, 401]);
  assert.equal(sessionCookie(await context.cookies()), undefined);
  secrets.push(first.secret, first.uri, pending[0].qrDataUrl, otp);

  // 계정 없음/비ADMIN/정지/잘못된 password는 동일한 공개 실패를 반환한다.
  for (const account of ["missing", "user", "disabled"]) {
    const response = await post(context, origin, "setup", {
      email: `${account}@p04.example.test`,
      password,
    });
    assert.equal(response.status(), 401);
    assert.equal((await response.json()).code, "UNAUTHENTICATED");
  }
  assert.equal(
    (
      await post(context, origin, "setup", {
        email: "enroll-ui@p04.example.test",
        password: "wrong-password",
      })
    ).status(),
    401,
  );
  for (const supplied of [undefined, "null", "http://127.0.0.1:3200", "https://evil.test"]) {
    for (const operation of ["setup", "confirm"])
      assert.equal(
        (
          await post(
            context,
            origin,
            operation,
            { email, password, otp, version: stored.version },
            supplied ? { Origin: supplied } : {},
          )
        ).status(),
        403,
      );
  }
  assert.equal(
    (
      await post(context, origin, "confirm", {
        email,
        password,
        otp: 123456,
        version: stored.version,
      })
    ).status(),
    400,
  );
  assert.equal(
    (await post(context, origin, "confirm", { email, password, otp, version: 0 })).status(),
    400,
  );
  assert.equal(
    (
      await context.request.post(`${origin}/api/auth/mfa/setup`, {
        headers: { Origin: origin, "content-type": "text/plain" },
        data: "{}",
      })
    ).status(),
    400,
  );

  const page = await context.newPage();
  const uiEmail = "enroll-ui@p04.example.test";
  const uiPosts = [];
  page.on("request", (request) => {
    if (request.method() === "POST") uiPosts.push(new URL(request.url()).pathname);
  });
  await page.goto(`${origin}/admin-login`);
  await page.getByLabel("Email").waitFor();
  await page.screenshot({ path: path.join(artifacts, "p05d-login.png") });
  async function register() {
    await page.getByRole("button", { name: "인증기 등록", exact: true }).click();
    await page.getByLabel("Email").fill(uiEmail);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "QR 생성", exact: true }).click();
    const image = page.getByAltText("인증기 등록 QR 코드", { exact: true });
    await image.waitFor();
    const data = await image.getAttribute("src");
    const qr = scan(data);
    secrets.push(qr.secret, qr.uri, data);
    return qr;
  }
  // 취소/페이지 이탈은 QR·password를 버린다. pending 자체는 재시도 시 재사용한다.
  const abandoned = await register();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  assert.equal(await page.getByAltText("인증기 등록 QR 코드").count(), 0);
  assert.equal(await page.getByLabel("Password").inputValue(), "");
  const abandonedAgain = await register();
  assert.ok(abandoned.secret === abandonedAgain.secret, "retry reuses pending secret");
  await page.goto(`${origin}/`);
  await page.goBack();
  await page.getByLabel("Email").waitFor();
  assert.equal(await page.getByAltText("인증기 등록 QR 코드").count(), 0);
  assert.equal(await page.getByLabel("Password").inputValue(), "");

  const current = await register();
  let usedOtp = generateSync({ secret: current.secret });
  secrets.push(usedOtp);
  await page.getByLabel("인증 코드").fill(usedOtp);
  await page.getByRole("button", { name: "등록 확인", exact: true }).click();
  await page.getByText("다음 코드로 로그인하세요. 비밀번호를 다시 입력해주세요.").waitFor();
  assert.equal(await page.getByAltText("인증기 등록 QR 코드").count(), 0);
  assert.equal(sessionCookie(await context.cookies()), undefined);
  assert.equal((await context.request.get(`${origin}/api/admin/songs`)).status(), 401);
  await page.screenshot({ path: path.join(artifacts, "p05d-enrolled.png") });

  async function login(token, success) {
    await page.getByLabel("Email").fill(uiEmail);
    await page.getByLabel("Password").fill(password);
    const count = uiPosts.length;
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByLabel("인증 코드").waitFor();
    assert.equal(uiPosts.length, count, "first login step makes no server request");
    await page.getByLabel("인증 코드").fill(token);
    await page.getByRole("button", { name: "로그인", exact: true }).click();
    if (success) await page.waitForURL(`${origin}/admin/albums`);
    else await page.getByText("인증 정보를 확인해주세요.", { exact: true }).waitFor();
  }
  async function nextOtp(secret) {
    const [row] =
      await sql`select last_used_step from admin_mfa where account_id=(select account_id from password_credential where email=${uiEmail})`;
    while (Math.floor(Date.now() / 30_000) <= Number(row.last_used_step))
      await new Promise((resolve) => setTimeout(resolve, 100));
    const token = generateSync({ secret });
    secrets.push(token);
    return token;
  }
  await page.getByRole("button", { name: "로그인으로 돌아가기", exact: true }).click();
  await login(usedOtp, false);
  assert.equal(sessionCookie(await context.cookies()), undefined);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await login(await nextOtp(current.secret), true);
  assert.ok(sessionCookie(await context.cookies()));
  assert.equal((await context.request.get(`${origin}/api/admin/songs`)).status(), 200);
  const [old] =
    await sql`select version from admin_mfa where account_id=(select account_id from password_credential where email=${uiEmail})`;
  await changeConsoleAccess(sql, "ADMIN", "ACTIVE", true, uiEmail);
  assert.equal((await context.request.get(`${origin}/api/admin/songs`)).status(), 401);
  assert.equal(
    (
      await post(context, origin, "confirm", {
        email: uiEmail,
        password,
        otp: usedOtp,
        version: old.version,
      })
    ).status(),
    401,
  );
  // 기존 JWT를 보유한 채 재등록해도 과거 version의 세션이 다시 유효해지지 않는다.
  await page.goto(`${origin}/admin-login`);
  const replacement = await register();
  assert.ok(current.secret !== replacement.secret, "reset must generate a new pending secret");
  const replacementOtp = generateSync({ secret: replacement.secret });
  secrets.push(replacementOtp);
  await page.getByLabel("인증 코드").fill(replacementOtp);
  await page.getByRole("button", { name: "등록 확인", exact: true }).click();
  await page.getByText("다음 코드로 로그인하세요. 비밀번호를 다시 입력해주세요.").waitFor();
  assert.equal((await context.request.get(`${origin}/api/admin/songs`)).status(), 401);
  await page.getByRole("button", { name: "로그인으로 돌아가기", exact: true }).click();
  await login(await nextOtp(replacement.secret), true);
  assert.equal((await context.request.get(`${origin}/api/admin/songs`)).status(), 200);
  const persisted = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  for (const value of [...secrets, password])
    assert.ok(
      !persisted.includes(value),
      "authentication values must not be persisted in browser storage",
    );

  for (let i = 0; i < 5; i++) {
    const response = await post(context, origin, "setup", {
      email: "enroll-limit@p04.example.test",
      password: "wrong-password",
    });
    assert.equal(response.status(), 401);
  }
  for (const operation of ["setup", "confirm"]) {
    const response = await post(context, origin, operation, {
      email: "enroll-limit@p04.example.test",
      password,
      otp: "123456",
      version: 1,
    });
    assert.equal(response.status(), 429);
    assert.equal((await response.json()).code, "OTP_RATE_LIMITED");
    assert.ok(Number(response.headers()["retry-after"]) > 0);
  }
  // 별도 context의 유효 JWT는 로그인 화면을 건너뛰므로 callback 안내는 anonymous context에서 확인한다.
  const anonymous = await browser.newContext();
  const notice = await anonymous.newPage();
  await notice.goto(`${origin}/admin-login?code=rate_limited`);
  await notice
    .getByText("요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.", { exact: true })
    .waitFor();
  await anonymous.close();
  await context.close();
  console.log(
    "Console D passed: actual PNG scan, concurrent stored QR/confirm, closed enrollment, UI registration/next-code login, reset/re-enrollment and safe storage",
  );
  return secrets;
}
