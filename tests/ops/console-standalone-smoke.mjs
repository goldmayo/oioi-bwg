import assert from "node:assert/strict";

import { chromium } from "playwright";

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

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("/admin", origin).href);
  await page.waitForURL(new URL("/admin-login", origin).href);
  await page.getByRole("button", { name: "로그인", exact: true }).waitFor();
  assert.equal(await page.getByLabel("Email").count(), 1);
  assert.equal(await page.getByLabel("Password").count(), 1);
  assert.deepEqual(errors, [], "Console browser runtime errors");
  if (process.env.P04_SCREENSHOT_PATH)
    await page.screenshot({ path: process.env.P04_SCREENSHOT_PATH });
} finally {
  await browser.close();
}
console.log(
  "Console standalone smoke passed: health, dedicated cookies, login redirect and hydration",
);
