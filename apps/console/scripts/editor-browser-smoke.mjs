import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { chromium } from "playwright";

const app = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = resolve(app, "../..");
const out = resolve(process.argv[2] ?? join(root, ".local/artifacts/p09-editor"));
const require = createRequire(join(app, "package.json"));
await mkdir(out, { recursive: true });
const song = {
  id: "019a0170-0000-7000-8000-000000000001",
  title: "P09 편집 검증곡",
  albumName: "검증 앨범",
  youtubeId: "abcdefghijk",
  lyrics: [
    {
      startTime: 0.4,
      isExtra: false,
      segments: [
        { text: "함께 부르는 ", isCheer: false, isEcho: false },
        { text: "첫 번째 ", isCheer: true, isEcho: false },
        { text: "가사", isCheer: true, isEcho: true, startTimeOffset: 0.25 },
      ],
    },
    {
      startTime: 4,
      isExtra: true,
      segments: [0, 0.8, 1.6, 2.4].map((startTimeOffset) => ({
        text: "어이!",
        isCheer: true,
        isEcho: false,
        startTimeOffset,
      })),
    },
    {
      startTime: 8,
      isExtra: false,
      segments: [{ text: "함께 외치는 다음 가사", isCheer: false, isEcho: true }],
    },
    {
      startTime: 13,
      isExtra: false,
      segments: [{ text: "마지막 가사", isCheer: false, isEcho: false }],
    },
  ],
};
const peaks = {
  version: 1,
  sample_rate: 24000,
  samples_per_pixel: 480,
  bits: 8,
  length: 9000,
  data: [],
};
for (let i = 0; i < peaks.length; i++) {
  const n = Math.round(
    18 +
      70 * Math.abs(Math.sin(i * 0.017) * Math.cos(i * 0.023)) +
      22 * Math.abs(Math.sin(i * 1.7)),
  );
  peaks.data.push(-n, n);
}
const data = {
  durationMs: 180000,
  bucketSizeMs: 20,
  peaks,
  source: { type: "youtube", id: song.youtubeId },
  generationVersion: 1,
};
// An already generated JSON can exercise the upload/display boundary without extracting media.
const importedWaveform = process.env.WAVEFORM_JSON_PATH
  ? {
      ...data,
      ...JSON.parse(await readFile(process.env.WAVEFORM_JSON_PATH, "utf8")),
      source: data.source,
    }
  : data;
let displayedWaveform = data;
let imports = 0;
let responseMode = "ready",
  saveStatus = 200;
let lastSaved = null;
const actualLyrics = JSON.parse(
  await readFile(join(root, "tests/fixtures/song-01a17439-lyrics.json"), "utf8"),
);
const actualSong = {
  ...song,
  id: "01a17439-dddf-76af-9716-2c0fcf925b82",
  title: "첨부 Song.lyrics 검증",
  lyrics: actualLyrics,
};
const corpus = process.env.LYRICS_CORPUS_PATH
  ? JSON.parse(await readFile(process.env.LYRICS_CORPUS_PATH, "utf8"))
  : [];
const recordRegressions = process.argv.includes("--record-regressions");
const regressions = [];
const fixtureSource = `import React from 'react';import {createRoot} from 'react-dom/client';import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import Editor from '${app}/src/features/manage-lyrics/ui/LyricsEditorClient.tsx';
import {AdminWorkspace} from '${app}/src/app/(admin)/admin/_ui/admin-sidebar.tsx';
import {Toaster} from '${app}/src/shared/ui/sonner.tsx';import {toast} from 'sonner';window.__dismissToasts=toast.dismiss;
window.YT={PlayerState:{PLAYING:1},Player:class{
 constructor(el,options){this.time=4;this.state=2;this.options=options;this.videoId=options.videoId;window.__iframe=this;(window.__players??=[]).push(this);el.innerHTML='<div style="height:100%;display:grid;place-items:center;background:#202c35;color:#dce9f1;font-size:13px">YouTube IFrame 검증 대역</div>';queueMicrotask(()=>options.events.onReady({target:this}));}
 getCurrentTime(){return this.time}getDuration(){return 180}getPlayerState(){return this.state}getVideoData(){return {video_id:this.videoId,author:'',title:''}}
 playVideo(){this.state=1;this.options.events.onStateChange({target:this,data:1});this.timer=setInterval(()=>this.time+=.1,100)}pauseVideo(){this.state=2;clearInterval(this.timer);this.options.events.onStateChange({target:this,data:2})}
 seekTo(time){setTimeout(()=>this.time=time,150)}destroy(){clearInterval(this.timer)}
}};
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const song=new URLSearchParams(location.search).has("actual")?await fetch("/actual-song"+location.search).then(r=>r.json()):${JSON.stringify(song)};
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><AdminWorkspace><Editor song={song} accountId="test-admin" waveformImport={{videoId:song.youtubeId,onError(){}}} saveSongData={async(id,input)=>{const response=await fetch('/save',{method:'POST',body:JSON.stringify(input)});if(!response.ok)throw Error('save rejected');return {id};}}/></AdminWorkspace><Toaster/></QueryClientProvider>);`;
const bundling = {
  stdin: { contents: fixtureSource, loader: "tsx", resolveDir: app },
  bundle: true,
  outfile: join(out, "editor.js"),
  format: "esm",
  platform: "browser",
  jsx: "automatic",
  tsconfig: join(app, "tsconfig.json"),
  define: { "process.env.NODE_ENV": '"development"', "process.env": "{}" },
  plugins: [
    {
      name: "browser-fixtures",
      setup(b) {
        b.onResolve({ filter: /^next\/(link|navigation|dynamic|image)$/ }, (a) => ({
          path: a.path,
          namespace: "fixture",
        }));
        b.onResolve({ filter: /^@\/features\/auth$/ }, () => ({
          path: "auth",
          namespace: "fixture",
        }));
        b.onResolve({ filter: /notification-provider$/ }, () => ({
          path: "notifications",
          namespace: "fixture",
        }));
        b.onResolve({ filter: /^client-only$/ }, () => ({ path: "client", namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
          contents:
            path === "next/image"
              ? `import React from "react";export default ({fill,priority,unoptimized,...props})=>React.createElement("img",props);`
              : path === "next/link"
                ? `import React from 'react';export default ({prefetch,children,...props})=>React.createElement('a',props,children);`
                : path === "next/navigation"
                  ? `export const usePathname=()=>'/admin/edit/test';export const useRouter=()=>({push(){}});`
                  : path === "next/dynamic"
                    ? `import React,{lazy,Suspense} from 'react';export default (load,options)=>{const Component=lazy(load);return props=>React.createElement(Suspense,{fallback:options.loading?React.createElement(options.loading):null},React.createElement(Component,props));};`
                    : path === "auth"
                      ? `export const signOut=async()=>{};`
                      : path === "notifications"
                        ? `export const useNotificationContext=()=>({accountId:'test-admin'});`
                        : "export {};",
          loader: "js",
          resolveDir: app,
        }));
      },
    },
  ],
};
await build(bundling);
const webApp = join(root, "apps/web");
await build({
  ...bundling,
  stdin: {
    contents: `
import React from 'react';import {createRoot} from 'react-dom/client';import {NuqsTestingAdapter} from 'nuqs/adapters/testing';
import {LyricsViewerClient} from '${webApp}/src/features/chant-sync/ui/LyricsViewerClient.tsx';
${fixtureSource.slice(fixtureSource.indexOf("window.YT="), fixtureSource.indexOf("const client=")).replace("this.time+=.1", "void 0")}
const song=await fetch('/actual-song'+location.search).then(r=>r.json());
createRoot(document.getElementById('root')).render(<NuqsTestingAdapter><LyricsViewerClient song={song}/></NuqsTestingAdapter>);
`,
    loader: "tsx",
    resolveDir: webApp,
  },
  outfile: join(out, "viewer.js"),
  tsconfig: join(webApp, "tsconfig.json"),
});
const postcss = require("postcss"),
  tailwind = require("@tailwindcss/postcss");
const css = await postcss([tailwind({ base: app, optimize: false })]).process(
  await readFile(join(app, "src/app/globals.css"), "utf8"),
  { from: join(app, "src/app/globals.css") },
);
await writeFile(join(out, "editor.css"), css.css);
const webCss = await postcss([tailwind({ base: webApp, optimize: false })]).process(
  await readFile(join(webApp, "src/app/globals.css"), "utf8"),
  { from: join(webApp, "src/app/globals.css") },
);
await writeFile(
  join(out, "viewer.css"),
  webCss.css + (await readFile(join(out, "viewer.css"), "utf8").catch(() => "")),
);
const html =
  '<!doctype html><html lang="ko" class="dark"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/editor.css"></head><body><div id="root"></div><script type="module" src="/editor.js"></script></body></html>';
const server = createServer(async (req, res) => {
  const path = new URL(req.url, "http://localhost").pathname;
  try {
    if (path === "/actual-song") {
      res.setHeader("Content-Type", "application/json");
      const params = new URL(req.url, "http://localhost").searchParams;
      const source = params.has("index") ? corpus[Number(params.get("index"))] : actualSong;
      res.end(
        JSON.stringify({
          ...source,
          lyrics: params.has("saved") ? lastSaved.lyrics : source.lyrics,
        }),
      );
      return;
    }
    if (path === "/viewer") {
      res.setHeader("Content-Type", "text/html");
      res.end(html.replaceAll("editor.css", "viewer.css").replaceAll("editor.js", "viewer.js"));
      return;
    }
    if (path === "/save") {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      lastSaved = JSON.parse(Buffer.concat(chunks).toString());
      res.writeHead(saveStatus, { "Content-Type": "application/json" });
      res.end("{}");
      return;
    }
    if (path.startsWith("/api/admin/songs/")) {
      if (req.method === "PUT") {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        displayedWaveform = JSON.parse(Buffer.concat(chunks).toString());
        imports++;
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(
          JSON.stringify({
            id: song.id,
            songId: song.id,
            videoId: song.youtubeId,
            status: "SUCCEEDED",
            errorCode: null,
            createdAt: "2026-10-31T00:00:00Z",
            finishedAt: "2026-10-31T00:00:00Z",
            editorHref: "/admin/edit/test",
          }),
        );
        return;
      }
      res.writeHead(responseMode === "error" ? 500 : 200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          responseMode === "ready"
            ? displayedWaveform
            : responseMode === "empty"
              ? null
              : { code: "INTERNAL_SERVER_ERROR", message: "실패" },
        ),
      );
      return;
    }
    if (path.startsWith("/api/")) {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ items: [], nextCursor: null, unreadCount: 0 }));
      return;
    }
    if (["/editor.js", "/editor.css", "/viewer.js", "/viewer.css"].includes(path)) {
      res.setHeader("Content-Type", extname(path) === ".js" ? "text/javascript" : "text/css");
      res.end(await readFile(join(out, path)));
      return;
    }
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  } catch (error) {
    res.writeHead(500).end(String(error));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const origin = "http://127.0.0.1:" + server.address().port;
if (process.argv.includes("--serve")) {
  console.log(origin);
  await new Promise(() => {});
}
const browser = await chromium.launch({ headless: true });

const checks = [];
const capture = async (page, name) => {
  await page.evaluate(() => {
    window.__dismissToasts?.();
    window.scrollTo(0, 0);
    for (const element of document.querySelectorAll("main,[data-editor-scroll]"))
      element.scrollTop = 0;
  });
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(out, name), fullPage: true });
};
const row = (page, index) => page.locator(`[data-lyric-row="${index}"]`);
const rowTime = (page, index) =>
  page.getByRole("textbox", { name: `${index + 1}행 시작 시각`, exact: true });
const selectRow = (page, index) => row(page, index).locator("[data-row-text]").click();
const expandRow = async (page, index) => {
  const button = page.getByRole("button", { name: `${index + 1}행 상세 편집`, exact: true });
  if ((await button.getAttribute("aria-expanded")) !== "true") await button.click();
};
const save = async (page) => {
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/save") && r.request().method() === "POST"),
    page.locator("[data-lyrics-editor] > header").getByRole("button", { name: /^저장/ }).click(),
  ]);
  await page.getByText("저장됨", { exact: true }).waitFor();
};
const undo = (page) => page.getByRole("button", { name: "실행 취소", exact: true }).click();
const clock = async (page, time) => {
  await page.evaluate((time) => {
    window.__iframe.time = time;
  }, time);
  await page.waitForTimeout(200);
};

async function verifyQA(page, width) {
  responseMode = "ready";
  saveStatus = 200;
  const tab = async (name) => page.getByRole("tab", { name, exact: true }).click();
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator('[aria-label="확대 waveform"] canvas').first().waitFor();
  await clock(page, 1.25);
  const geometry = await page.evaluate(() => {
    const rect = (selector) => {
      const r = document.querySelector(selector).getBoundingClientRect();
      return { left: r.left, top: r.top, bottom: r.bottom, width: r.width, height: r.height };
    };
    const roll = document.querySelector("[data-piano-roll]");
    return {
      wave: rect('[aria-label="확대 waveform"]'),
      ruler: rect("[data-note-ruler]>div:last-child"),
      lyrics: rect('[data-note-track="lyrics"]'),
      extra: rect('[data-note-track="extra"]'),
      overlay: rect("[data-timeline-overlay]"),
      cti: rect("[data-editor-cti]"),
      start: Number(roll.dataset.noteStart),
      end: Number(roll.dataset.noteEnd),
      count: document.querySelectorAll("[data-editor-cti]").length,
      overflow: document.documentElement.scrollWidth > innerWidth,
    };
  });
  await capture(page, `qa-timing-${width}.png`);
  assert.equal(geometry.count, 1);
  assert.equal(geometry.overflow, false);
  for (const key of ["ruler", "lyrics", "extra", "overlay"]) {
    assert.ok(Math.abs(geometry[key].left - geometry.wave.left) < 1, `${key} shared origin`);
    assert.ok(Math.abs(geometry[key].width - geometry.wave.width) < 1, `${key} shared width`);
  }
  assert.ok(
    Math.abs(
      geometry.cti.left -
        (geometry.wave.left +
          ((1.25 - geometry.start) / (geometry.end - geometry.start)) * geometry.wave.width),
    ) < 1,
    "CTI uses actual visible range",
  );
  assert.ok(
    geometry.overlay.top <= geometry.wave.top &&
      geometry.overlay.bottom >= geometry.extra.bottom - 1,
    "one CTI spans all three regions",
  );
  assert.equal(
    await page.getByRole("button", { name: "전체 waveform 보기", exact: true }).count(),
    0,
  );
  assert.equal(await page.getByRole("button", { name: "편집 도구", exact: true }).count(), 0);
  assert.equal(await page.locator("header output").count(), 0);
  assert.ok((await page.getByRole("definition").count()) >= 7);
  for (const name of [
    "따라가기",
    "구간 반복",
    "현재 위치에 노트 추가",
    "선택 노트 복제",
    "선택 노트 삭제",
  ])
    assert.equal((await page.getByRole("button", { name, exact: true }).textContent()).trim(), "");
  checks.push({ width, sharedCTI: true, geometry });
  await tab("가사");
  await save(page);
  assert.deepEqual(lastSaved.lyrics, song.lyrics);
  await rowTime(page, 1).fill("00:04.125");
  await rowTime(page, 1).press("Enter");
  const beforeImport = lastSaved;
  const importCount = imports;
  await Promise.all([
    page.waitForResponse((r) => r.request().method() === "PUT" && r.url().endsWith("/waveform")),
    page.getByLabel("waveform JSON 파일", { exact: true }).setInputFiles({
      name: "waveform.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(importedWaveform)),
    }),
  ]);
  await page.getByRole("link", { name: "등록 결과 확인", exact: true }).waitFor();
  assert.equal(imports, importCount + 1);
  assert.equal(lastSaved, beforeImport);
  assert.equal(await rowTime(page, 1).inputValue(), "00:04.125");
  await undo(page);
  assert.equal(await rowTime(page, 1).inputValue(), "00:04.000");
  await page.getByRole("checkbox", { name: "2행 노트 선택", exact: true }).check();
  assert.equal(
    await page.getByRole("spinbutton", { name: "2행 2번째 조각 오프셋", exact: true }).count(),
    0,
  );
  await expandRow(page, 1);
  await clock(page, 5.1);
  const offset = page.getByRole("spinbutton", { name: "2행 2번째 조각 오프셋", exact: true });
  await offset
    .locator("xpath=..")
    .getByTitle("현재 재생 시간으로 오프셋 캡처", { exact: true })
    .click();
  await save(page);
  assert.deepEqual(
    lastSaved.lyrics[1].segments.map((s) => s.startTimeOffset ?? 0),
    [0, 1.1, 1.6, 2.4],
  );
  await undo(page);
  await rowTime(page, 1).fill("5.25");
  await rowTime(page, 1).press("Control+s");
  await page.getByText("저장됨", { exact: true }).waitFor();
  assert.equal(lastSaved.lyrics[1].startTime, 5.25);
  await undo(page);
  await rowTime(page, 1).fill("invalid");
  await rowTime(page, 1).press("Enter");
  assert.equal(await rowTime(page, 1).inputValue(), "00:04.000");
  await page.getByRole("button", { name: "1행 텍스트 수정", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "3번째 조각 내용", exact: true })
    .fill("초안 미리보기");
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  const lastWrite = lastSaved;
  await page
    .getByRole("button", { name: "현재 초안을 사용자 화면으로 미리보기", exact: true })
    .click();
  const preview = page.getByRole("dialog");
  assert.ok(await preview.getByText("초안 미리보기", { exact: true }).isVisible());
  assert.equal(lastSaved, lastWrite, "preview does not save");
  await capture(page, `qa-preview-${width}.png`);
  assert.ok((await preview.boundingBox()).width <= width - 20);
  await page.keyboard.press("Escape");
  await page.evaluate(() => (window.__iframe = window.__players[0]));
  await save(page);
  assert.deepEqual(lastSaved.lyrics[0].segments, [
    song.lyrics[0].segments[0],
    song.lyrics[0].segments[1],
    { ...song.lyrics[0].segments[2], text: "초안 미리보기" },
  ]);
  await undo(page);
  await selectRow(page, 0);
  await expandRow(page, 0);
  await row(page, 0).getByRole("button", { name: "응원·에코 표시", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "완료", exact: true }).click();
  await save(page);
  assert.deepEqual(
    lastSaved.lyrics,
    song.lyrics,
    "untouched paint preserves offsets and dual flags",
  );
  await capture(page, `qa-lyrics-${width}.png`);
  const missing = await page
    .locator("button:visible")
    .evaluateAll((nodes) =>
      nodes.filter((n) => !n.title).map((n) => n.getAttribute("aria-label") || n.textContent),
    );
  assert.deepEqual(missing, [], "every visible button has hover help");
  checks.push({
    width,
    rowEditing: true,
    importPreservesDraftUndo: true,
    previewUsesUnsavedDraft: true,
  });
  if (width !== 1280) return;
  await page.reload({ waitUntil: "networkidle" });
  await page.locator('[aria-label="확대 waveform"] canvas').first().waitFor();
  const previous = page.getByRole("button", { name: "이전 노트 구간", exact: true });
  if (await previous.isEnabled()) await previous.click();
  await page.waitForTimeout(200);
  const note = page.locator('[data-editor-note="line:0"]');
  await note.click();
  const box = await note.boundingBox();
  await page.mouse.move(box.x + 8, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y + 12, { steps: 5 });
  await page.mouse.up();
  assert.ok(Number(await note.getAttribute("data-note-time")) > 0.4);
  await undo(page);
  assert.equal(Number(await note.getAttribute("data-note-time")), 0.4);
  const original = await note.boundingBox();
  await page.mouse.move(original.x + 8, original.y + 12);
  await page.mouse.down();
  await page.mouse.move(original.x + 65, original.y + 12, { steps: 5 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.equal(Number(await note.getAttribute("data-note-time")), 0.4);
  await note.click();
  await page.getByRole("button", { name: "선택 노트 복제", exact: true }).click();
  await save(page);
  assert.equal(lastSaved.lyrics.length, song.lyrics.length + 1);
  await page.getByRole("button", { name: "선택 노트 삭제", exact: true }).click();
  await save(page);
  assert.deepEqual(lastSaved.lyrics, song.lyrics);
  await tab("가사");
  await page.getByRole("checkbox", { name: "2행 노트 선택", exact: true }).check();
  await page.getByLabel("선택 노트 문구", { exact: true }).fill("같이!");
  await page.getByRole("button", { name: "문구 일괄 적용", exact: true }).click();
  await tab("타이밍");
  await save(page);
  assert.deepEqual(
    lastSaved.lyrics[1].segments.map((s) => s.text),
    ["같이!", "같이!", "같이!", "같이!"],
  );
  await undo(page);
  await page.getByRole("button", { name: "구간 반복", exact: true }).click();
  assert.ok(await page.getByLabel("반복 시작 초", { exact: true }).isVisible());
  const target = page.getByLabel("반복 구간 선택", { exact: true });
  const wave = await target.boundingBox();
  await page.mouse.move(wave.x + wave.width * 0.2, wave.y + 40);
  await page.mouse.down();
  await page.mouse.move(wave.x + wave.width * 0.65, wave.y + 40, { steps: 8 });
  await page.mouse.up();
  const a = Number(await page.getByLabel("반복 시작 초", { exact: true }).inputValue()),
    b = Number(await page.getByLabel("반복 끝 초", { exact: true }).inputValue());
  assert.ok(b - a > 0.5);
  await clock(page, b + 0.1);
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.waitForTimeout(500);
  assert.ok(
    await page.evaluate(({ a, b }) => window.__iframe.time >= a && window.__iframe.time < b, {
      a,
      b,
    }),
  );
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await capture(page, "qa-loop-1280.png");
  await page.getByRole("button", { name: "구간 반복", exact: true }).click();
  const before = Number(await page.locator("[data-piano-roll]").getAttribute("data-note-start"));
  await page.locator('[aria-label="확대 waveform"]').hover();
  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 200);
  await page.keyboard.up("Shift");
  await page.waitForTimeout(250);
  assert.ok(
    Number(await page.locator("[data-piano-roll]").getAttribute("data-note-start")) > before,
  );
  assert.equal(
    await page.getByRole("button", { name: "따라가기", exact: true }).getAttribute("aria-pressed"),
    "false",
  );
  for (const mode of ["empty", "error"]) {
    responseMode = mode;
    await page.reload({ waitUntil: "networkidle" });
    await clock(page, 12.5);
    await page.getByRole("button", { name: "현재 위치에 노트 추가", exact: true }).click();
    await page.getByLabel("선택 노트 문구", { exact: true }).fill("waveform 없이 편집");
    await page.getByRole("button", { name: "문구 적용", exact: true }).click();
    await save(page);
    assert.ok(
      lastSaved.lyrics.some((line) => line.segments.some((s) => s.text === "waveform 없이 편집")),
    );
  }
  responseMode = "ready";
  checks.push({
    width,
    dragUndoCancel: true,
    duplicateDelete: true,
    multiEditTabState: true,
    waveformABLoop: true,
    shiftWheel: true,
    emptyAndErrorFallback: true,
  });
}

async function verifyActualDraft(page, width) {
  responseMode = "ready";
  saveStatus = 200;
  await page.goto(origin + "/?actual", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "가사", exact: true }).click();
  assert.equal(await page.locator("[data-lyric-row]").count(), actualLyrics.length);
  await save(page);
  assert.deepEqual(lastSaved.lyrics, actualLyrics, "actual JSON unchanged save");
  await page
    .getByRole("button", { name: "현재 초안을 사용자 화면으로 미리보기", exact: true })
    .click();
  const rendered = await page
    .locator("[data-preview-segment]")
    .evaluateAll((nodes) => nodes.map((n) => n.textContent));
  assert.deepEqual(
    rendered,
    actualLyrics.flatMap((line) => line.segments.map((segment) => segment.text)),
    "actual preview preserves every segment",
  );
  const margins = await page.locator("[data-preview-segment]").evaluateAll((nodes) =>
    nodes.map((node) => ({
      left: parseFloat(getComputedStyle(node).marginLeft),
      gap: getComputedStyle(node.parentElement).columnGap,
    })),
  );
  let offset = 0;
  for (const line of actualLyrics)
    for (const [index, segment] of line.segments.entries()) {
      const shouldSeparate =
        line.isExtra &&
        index > 0 &&
        (segment.startTimeOffset ?? 0) !== (line.segments[index - 1].startTimeOffset ?? 0);
      assert.equal(
        margins[offset].left > 0,
        Boolean(shouldSeparate),
        "only distinct extra cues have a gap",
      );
      assert.ok(
        margins[offset].gap === "normal" || parseFloat(margins[offset].gap) === 0,
        "same-cue fragments stay joined",
      );
      offset++;
    }
  await page.keyboard.press("Escape");
  await capture(page, `qa-actual-lyrics-${width}.png`);
  checks.push({ width, actualLyricsUnchangedSave: true, actualPreviewText: true });
}

try {
  for (const width of [1586, 1280, 390]) {
    const page = await browser.newPage({
      viewport: { width, height: width === 1586 ? 992 : 1000 },
    });
    page.setDefaultTimeout(10000);
    await page.route(/^https:\/\/(?:img\.youtube\.com|i\.ytimg\.com)\//, (route) =>
      route.fulfill({
        contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
      }),
    );
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (
        message.type() === "error" &&
        !/^Failed to load resource:.*(?:409|500)/.test(message.text())
      )
        errors.push(message.text());
    });
    await verifyQA(page, width);
    await verifyActualDraft(page, width);
    assert.deepEqual(errors, []);
    await page.close();
  }
  const corpusResults = [];
  const corpusErrors = [];
  const corpusPage = await browser.newPage({
    viewport: { width: 1280, height: 1000 },
    reducedMotion: "reduce",
  });
  corpusPage.on("pageerror", (error) => corpusErrors.push(error.message));
  corpusPage.on("console", (message) => {
    if (message.type() === "error") corpusErrors.push(message.text());
  });
  await corpusPage.route(/^https:\/\/(?:img\.youtube\.com|i\.ytimg\.com)\//, (route) =>
    route.fulfill({
      contentType: "image/gif",
      body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
    }),
  );
  for (const [index, source] of corpus.entries()) {
    responseMode = "empty";
    saveStatus = 200;
    await corpusPage.goto(origin + "/?actual&index=" + index, { waitUntil: "networkidle" });
    const expectedRows = source.lyrics.length;
    assert.equal(await corpusPage.locator("[data-lyric-row]").count(), expectedRows, source.title);
    const editorColors = await corpusPage
      .locator("[data-lyric-row] [data-line][data-seg]")
      .evaluateAll((nodes) =>
        nodes.map((n) => ({
          line: Number(n.dataset.line),
          segment: Number(n.dataset.seg),
          color: getComputedStyle(n).color,
        })),
      );
    await Promise.all([
      corpusPage.waitForResponse(
        (r) => r.url().endsWith("/save") && r.request().method() === "POST",
      ),
      corpusPage.getByRole("button", { name: /^저장/ }).click(),
    ]);
    assert.deepEqual(lastSaved.lyrics, source.lyrics, source.title + " unchanged save");
    await corpusPage.goto(origin + "/viewer?index=" + index + "&saved", {
      waitUntil: "networkidle",
    });
    const lines = corpusPage.getByRole("region", { name: "응원법 가사" }).getByRole("button");
    assert.equal(await lines.count(), source.lyrics.length, source.title);
    const viewer = await lines.evaluateAll((nodes) =>
      nodes.map((line) =>
        [...line.querySelectorAll("[data-lyric-segment]")].map((segment) => ({
          text: segment.textContent,
          color: getComputedStyle(segment).color,
        })),
      ),
    );
    for (const [i, line] of source.lyrics.entries()) {
      assert.deepEqual(
        viewer[i].map((s) => s.text),
        line.segments.map((s) => s.text),
        source.title + " text structure",
      );
    }
    for (const appearance of editorColors) {
      const line = source.lyrics[appearance.line],
        segment = line.segments[appearance.segment];
      if (line.isExtra || segment.isEcho || segment.isCheer)
        assert.equal(
          appearance.color,
          viewer[appearance.line][appearance.segment].color,
          source.title + " semantic color",
        );
    }
    corpusResults.push({
      title: source.title,
      lines: source.lyrics.length,
      rows: expectedRows,
      unchangedSave: true,
      textAndColors: true,
    });
  }
  assert.deepEqual(corpusErrors, [], "local corpus browser errors");
  await corpusPage.close();
  await writeFile(
    join(out, "local-corpus-report.json"),
    JSON.stringify(
      { songs: corpusResults.length, results: corpusResults, errors: corpusErrors },
      null,
      2,
    ),
  );
  await writeFile(
    join(out, "browser-report.json"),
    JSON.stringify(
      {
        passed: true,
        fixture:
          "mechanical tests use synthetic BBC; conformance tests use supplied and local corpus lyrics; real React/Peaks/viewer with YouTube, poster and HTTP boundaries stubbed",
        checks,
      },
      null,
      2,
    ),
  );
  await writeFile(
    join(out, "actual-song-report.json"),
    JSON.stringify(
      {
        passed: regressions.length === 0,
        corpusSongs: corpusResults.length,
        songId: actualSong.id,
        lines: actualLyrics.length,
        segments: actualLyrics.reduce((n, l) => n + l.segments.length, 0),
        regressions,
        checks,
      },
      null,
      2,
    ),
  );
  console.log(JSON.stringify({ passed: !regressions.length, out, regressions, checks }));
  if (regressions.length && !recordRegressions)
    throw Error("Actual lyrics regressions: " + regressions.join("; "));
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
