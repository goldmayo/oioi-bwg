import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = resolve(process.argv[2] ?? join(app, "../../.local/artifacts/operator-manifest"));
const require = createRequire(join(app, "package.json"));
await mkdir(out, { recursive: true });
const id = "019a0170-0000-7000-8000-000000000001";
const song = {
  id,
  albumId: id,
  album: { name: "검증 앨범" },
  title: "파형 검증곡",
  slug: "test-song",
  youtubeId: "pbELDkeLdho",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 1,
  updatedAt: "2026-10-31",
};
await build({
  stdin: {
    contents: `import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {SongManagerClient} from '${app}/src/features/manage-song/ui/SongManagerClient.tsx';
import {songQueryKeys} from '${app}/src/entities/song';import {albumQueryKeys} from '${app}/src/entities/album';
const client=new QueryClient({defaultOptions:{queries:{staleTime:Infinity,retry:false}}});
const song=${JSON.stringify(song)};if(location.search.includes('invalid'))song.youtubeId='';
const songs=location.search.includes('pages')?[song,...Array.from({length:15},(_,i)=>({...song,id:'row-'+i,title:'추가 검증곡 '+i,youtubeId:'video'+String(i).padStart(6,'0')}))]:[song];
client.setQueryData(songQueryKeys.adminList(),{items:songs,nextCursor:null});
client.setQueryData(albumQueryKeys.adminList(),{items:[],nextCursor:null});
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><main className="p-4"><h1 className="mb-6 text-2xl">곡 관리</h1><SongManagerClient canManage /></main></QueryClientProvider>);`,
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
    const page = await browser.newPage({
      viewport: { width, height: 1000 },
      acceptDownloads: true,
    });
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.route("**/*", (route) =>
      route.request().url().startsWith(origin) ? route.continue() : route.abort(),
    );
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.getByRole("checkbox", { name: "파형 검증곡 선택" }).press("Space");
    assert.equal(
      await page
        .getByRole("checkbox", { name: "파형 검증곡 선택" })
        .evaluate((el) => el === document.activeElement),
      true,
    );
    await page.keyboard.press("Space");
    assert.equal(
      await page.getByRole("checkbox", { name: "파형 검증곡 선택" }).getAttribute("aria-checked"),
      "false",
    );
    await page.keyboard.press("Space");
    const button = page.getByRole("button", { name: "파형 작업 파일 다운로드 (1곡)" });
    assert.equal(await button.isEnabled(), true);
    const downloadPromise = page.waitForEvent("download");
    await button.click();
    const download = await downloadPromise;
    assert.match(
      download.suggestedFilename(),
      /^oioi-operator-waveform_\d{8}_\d{6}_\d{3}_KST\.json$/,
    );
    assert.deepEqual(JSON.parse(await readFile(await download.path(), "utf8")), {
      version: 1,
      videoIds: ["pbELDkeLdho"],
    });
    const search = page.getByPlaceholder("곡 제목, slug, 앨범명으로 검색...");
    await search.fill("검색 결과 없음");
    assert.equal(await button.isEnabled(), true);
    await search.fill("");
    await page.screenshot({ path: join(out, `manifest-${width}.png`), fullPage: true });
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      true,
    );
    await page.goto(origin + "/?invalid", { waitUntil: "networkidle" });
    await page.getByRole("checkbox", { name: "파형 검증곡 선택" }).click();
    await page.getByRole("button", { name: "파형 작업 파일 다운로드 (1곡)" }).click();
    assert.match(await page.getByRole("alert").innerText(), /파형 검증곡/);
    await page.goto(origin + "/?pages", { waitUntil: "networkidle" });
    await page.getByRole("checkbox", { name: "파형 검증곡 선택" }).click();
    await page.getByRole("button", { name: "다음", exact: true }).click();
    await page.getByRole("checkbox", { name: "추가 검증곡 14 선택" }).click();
    const batchPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "파형 작업 파일 다운로드 (2곡)" }).click();
    const batch = await batchPromise;
    assert.deepEqual(JSON.parse(await readFile(await batch.path(), "utf8")), {
      version: 1,
      videoIds: ["pbELDkeLdho", "video000014"],
    });
    assert.deepEqual(errors, []);
    results.push({ width, download: download.suggestedFilename(), errors });
    await page.close();
  }
  await writeFile(join(out, "report.json"), JSON.stringify(results, null, 2) + "\n");
  console.log(JSON.stringify(results));
} finally {
  await browser?.close();
  await new Promise((r) => server.close(r));
}
