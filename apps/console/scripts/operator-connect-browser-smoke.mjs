import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(process.argv[2] ?? join(app, "../../.local/artifacts/operator-connect"));
const require = createRequire(join(app, "package.json"));
await mkdir(out, { recursive: true });
await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {OperatorConnectForm} from '${app}/src/app/operator-connect/_ui/operator-connect-form.tsx';createRoot(document.getElementById('root')).render(<main className="bg-background flex min-h-screen items-center justify-center p-4"><OperatorConnectForm /></main>);`,
    loader: "tsx",
    resolveDir: app,
  },
  bundle: true,
  outfile: join(out, "app.js"),
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  tsconfig: join(app, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" },
  plugins: [
    {
      name: "next-link-fixture",
      setup(b) {
        // Next 전용 Sentry 어댑터는 fixture에서만 제외하고 UI·Ky·응답 파서는 실제 코드를 실행한다.
        b.onResolve({ filter: /shared\/api\/capture-client-error$/ }, () => ({
          path: "capture",
          namespace: "observability-fixture",
        }));
        b.onLoad({ filter: /.*/, namespace: "observability-fixture" }, () => ({
          contents: "export function captureClientErrorOnce() {}",
          loader: "js",
        }));
        b.onResolve({ filter: /^next\/link$/ }, () => ({ path: "link", namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({
          contents: `import React from 'react';export default ({prefetch,children,...props})=>React.createElement('a',props,children);`,
          loader: "js",
          resolveDir: app,
        }));
      },
    },
  ],
});
const css = await require("postcss")([
  require("@tailwindcss/postcss")({ base: app, optimize: false }),
]).process(await readFile(join(app, "src/app/globals.css"), "utf8"), {
  from: join(app, "src/app/globals.css"),
});
await writeFile(join(out, "app.css"), css.css);
const server = createServer(async (req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/") {
    res.setHeader("Content-Type", "text/html");
    res.end(
      '<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"></head><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>',
    );
    return;
  }
  if (!["/app.js", "/app.css"].includes(pathname)) {
    res.writeHead(404).end();
    return;
  }
  res.setHeader("Content-Type", pathname.endsWith(".js") ? "application/javascript" : "text/css");
  res.end(await readFile(join(out, pathname.slice(1))));
});
await new Promise((r) => server.listen(0, "127.0.0.1", r));
const origin = `http://127.0.0.1:${server.address().port}`;
let browser;
const results = [];
try {
  browser = await chromium.launch({ headless: true });
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    let calls = 0;
    await page.route("**/*", async (route) => {
      const request = route.request();
      if (!request.url().startsWith(origin)) return route.abort();
      if (new URL(request.url()).pathname === "/api/operator/auth/approve") {
        assert.equal(request.method(), "POST");
        assert.equal(request.headers().origin, origin);
        assert.deepEqual(request.postDataJSON(), { userCode: "ABCD-2345" });
        calls++;
        return route.fulfill({
          status: calls === 1 ? 429 : 200,
          contentType: "application/json",
          headers: { "Retry-After": "12" },
          body: JSON.stringify(
            calls === 1
              ? { code: "OPERATOR_RATE_LIMITED", message: "잠시 후 다시 시도해 주세요." }
              : { approved: true },
          ),
        });
      }
      return route.continue();
    });
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.screenshot({ path: join(out, `connect-${width}.png`), fullPage: true });
    await page.getByLabel("연결 코드").fill("123");
    await page.getByRole("button", { name: "연결 승인" }).click();
    await page.getByRole("alert").waitFor();
    assert.equal(calls, 0);
    await page.getByLabel("연결 코드").fill("abcd-2345");
    await page.getByLabel("연결 코드").press("Tab");
    assert.equal(
      await page
        .getByRole("button", { name: "연결 승인" })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Enter");
    await page.getByRole("alert").filter({ hasText: "12초" }).waitFor();
    assert.equal(await page.getByLabel("연결 코드").inputValue(), "abcd-2345");
    await page.screenshot({ path: join(out, `connect-error-${width}.png`), fullPage: true });
    await page.getByRole("button", { name: "연결 승인" }).click();
    await page.getByRole("status").waitFor();
    assert.equal(await page.getByLabel("연결 코드").count(), 0);
    await page.screenshot({ path: join(out, `connect-success-${width}.png`), fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    assert.deepEqual(errors, []);
    results.push({ width, calls, errors });
    await page.close();
  }
  await writeFile(join(out, "report.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();
  await new Promise((resolve) => server.close(resolve));
}
