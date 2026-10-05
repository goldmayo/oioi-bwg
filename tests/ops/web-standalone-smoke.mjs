import assert from "node:assert/strict";

import { chromium } from "playwright";

const baseUrl = process.argv[2];
assert.ok(baseUrl, "Usage: node tests/ops/web-standalone-smoke.mjs <base-url>");

async function get(path) {
  return fetch(new URL(path, baseUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
}

const health = await get("/healthz");
assert.equal(health.status, 200);
assert.deepEqual(await health.json(), { status: "ok" });

const manifestResponse = await get("/manifest.json");
assert.equal(manifestResponse.status, 200);
const manifest = await manifestResponse.json();
assert.equal(manifest.start_url, "/");
for (const path of ["/web-app-manifest-192x192.png", "/apple-icon.png", "/favicon.ico"]) {
  assert.equal((await get(path)).status, 200, path);
}

assert.equal((await get("/api/admin/songs")).status, 401);

for (const path of ["/admin-login", "/more"]) {
  const response = await get(path);
  assert.equal(response.status, 200, path);
  const html = await response.text();
  assert.ok(html.includes("/manifest.json"), path);
  const assets = [...new Set(html.match(/\/_next\/static\/[^"<> ]+\.(?:js|css)/g))];
  assert.ok(assets.length > 0, `${path}: expected Next static assets`);
  for (const asset of assets) {
    assert.equal((await get(asset)).status, 200, asset);
  }
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(new URL("/admin", baseUrl).href);
  await page.waitForURL(new URL("/admin-login", baseUrl).href);
  await page.goto(new URL("/more", baseUrl).href);
  await page.waitForLoadState("networkidle");
  assert.equal(new URL(page.url()).pathname, "/more");
  assert.deepEqual(errors, [], "browser runtime errors");
} finally {
  await browser.close();
}

console.log("Standalone smoke passed: health, public assets, admin auth, user URLs, JS/CSS");
