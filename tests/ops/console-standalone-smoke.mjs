import assert from "node:assert/strict";

import { chromium } from "playwright";
import { expect } from "playwright/test";

const baseUrl = process.argv[2];
assert.ok(baseUrl, "Usage: node tests/ops/console-standalone-smoke.mjs <base-url>");
const origin = new URL(baseUrl);
assert.ok(["localhost", "127.0.0.1"].includes(origin.hostname));

const health = await fetch(new URL("/healthz", origin));
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: "ok" });
const csrf = await fetch(new URL("/api/auth/csrf", origin));
assert.equal(csrf.status, 200);
assert.ok((await csrf.json()).csrfToken);
const cookies = csrf.headers.getSetCookie();
assert.ok(cookies.some((cookie) => cookie.startsWith("oioi-console.csrf-token=")));
assert.ok(cookies.every((cookie) => !cookie.includes("Domain=")));
const login = await fetch(new URL("/admin-login", origin));
assert.equal(login.status, 200);
const assets = [...new Set((await login.text()).match(/\/_next\/static\/[^"<> ]+\.(?:js|css)/g))];
assert.ok(assets.length > 0, "Console login must reference static assets");
for (const asset of assets) {
  assert.equal((await fetch(new URL(asset, origin))).status, 200, asset);
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  const rateLimitAlert = page.getByRole("alert").filter({ hasText: "요청 횟수를 초과했습니다." });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("/admin", origin).href);
  await page.waitForURL(new URL("/admin-login", origin).href);
  await page.getByRole("button", { name: "다음", exact: true }).waitFor();
  await expect(page.getByLabel("Email")).toHaveCount(1);
  await expect(page.getByLabel("Password")).toHaveCount(1);
  await expect(rateLimitAlert).toHaveCount(0);
  await page.goto(new URL("/admin-login?code=rate_limited", origin).href);
  await expect(rateLimitAlert).toHaveText("요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.");
  const posts = [];
  page.on("request", (request) => {
    if (request.method() === "POST") posts.push(request.url());
  });
  await page.getByLabel("Email").fill("standalone@example.test");
  await page.getByLabel("Password").fill("Standalone-fixture-1!");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  await page.getByLabel("인증 코드").waitFor();
  await expect(rateLimitAlert).toHaveCount(0);
  const otp = page.getByLabel("인증 코드");
  await otp.focus();
  await otp.pressSequentially("123");
  await expect(otp).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator('[data-slot="form-message"]')).toHaveCount(0);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(otp).toHaveAttribute("aria-invalid", "true");
  await expect(page.getByText("인증 코드 6자리를 입력해주세요.", { exact: true })).toBeVisible();
  await otp.fill("123456");
  await expect(otp).toHaveAttribute("aria-invalid", "false");
  await expect(page.locator('[data-slot="form-message"]')).toHaveCount(0);
  assert.equal(posts.length, 0, "first step does not authenticate or call an enrollment endpoint");
  assert.ok(
    (await page.context().cookies()).every(
      (cookie) => cookie.name !== "oioi-console.session-token",
    ),
  );
  assert.deepEqual(errors, [], "Console browser runtime errors");
  if (process.env.P04_SCREENSHOT_PATH)
    await page.screenshot({ path: process.env.P04_SCREENSHOT_PATH });
} finally {
  await browser.close();
}
console.log(
  "Console standalone smoke passed: health, dedicated cookies, login redirect and hydration",
);
