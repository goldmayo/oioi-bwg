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
 constructor(el,options){this.time=4;this.state=2;this.options=options;this.videoId=options.videoId;window.__iframe=this;el.innerHTML='<div style="height:100%;display:grid;place-items:center;background:#202c35;color:#dce9f1;font-size:13px">YouTube IFrame 검증 대역</div>';queueMicrotask(()=>options.events.onReady({target:this}));}
 getCurrentTime(){return this.time}getDuration(){return 180}getPlayerState(){return this.state}getVideoData(){return {video_id:this.videoId,author:'',title:''}}
 playVideo(){this.state=1;this.options.events.onStateChange({target:this,data:1});this.timer=setInterval(()=>this.time+=.1,100)}pauseVideo(){this.state=2;clearInterval(this.timer);this.options.events.onStateChange({target:this,data:2})}
 seekTo(time){setTimeout(()=>this.time=time,150)}destroy(){clearInterval(this.timer)}
}};
const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
const song=new URLSearchParams(location.search).has("actual")?await fetch("/actual-song"+location.search).then(r=>r.json()):${JSON.stringify(song)};
createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><AdminWorkspace><Editor song={song} accountId="test-admin" saveSongData={async(id,input)=>{const response=await fetch('/save',{method:'POST',body:JSON.stringify(input)});if(!response.ok)throw Error('save rejected');return {id};}}/></AdminWorkspace><Toaster/></QueryClientProvider>);`;
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
      res.writeHead(responseMode === "error" ? 500 : 200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify(
          responseMode === "ready"
            ? data
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
const browser = await chromium.launch({ headless: true });

const checks = [];
const capture = async (page, name) => {
  await page.evaluate(() => {
    window.__dismissToasts?.();
    window.scrollTo(0, 0);
    for (const element of document.querySelectorAll("main,[data-editor-scroll]"))
      element.scrollTop = 0;
  });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(out, name), fullPage: true });
};
const row = (page, index) => page.locator(`[data-lyric-row="${index}"]`);
const rowTime = (page, index) =>
  page.getByRole("textbox", { name: `${index + 1}행 시작 시각`, exact: true });
const selectRow = (page, index) =>
  page.getByRole("button", { name: `${index + 1}행 선택`, exact: true }).click();
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

async function verifyRows(page, width) {
  responseMode = "ready";
  saveStatus = 200;
  await page.goto(origin, { waitUntil: "networkidle" });
  assert.equal(await page.locator("[data-lyric-row]").count(), song.lyrics.length);
  assert.equal(await page.locator("[data-note-inspector],[data-note-table]").count(), 0);
  assert.equal(await page.locator("[data-note-track]").count(), 2, "notes are always visible");
  await save(page);
  assert.deepEqual(lastSaved.lyrics, song.lyrics);
  await selectRow(page, 1);
  const offset = page.getByRole("spinbutton", { name: "2행 2번째 조각 오프셋", exact: true });
  await clock(page, 5.1);
  await offset
    .locator("xpath=..")
    .getByTitle("현재 재생 시간으로 오프셋 캡처", { exact: true })
    .click();
  await save(page);
  assert.equal(lastSaved.lyrics[1].startTime, 4);
  assert.deepEqual(
    lastSaved.lyrics[1].segments.map((s) => s.startTimeOffset ?? 0),
    [0, 1.1, 1.6, 2.4],
  );
  await undo(page);
  await page.getByRole("button", { name: "행 시간 캡처", exact: true }).click();
  assert.equal(await rowTime(page, 1).inputValue(), "00:05.10");
  await save(page);
  assert.deepEqual(lastSaved.lyrics[1].segments, song.lyrics[1].segments);
  await undo(page);
  await rowTime(page, 1).fill("");
  await rowTime(page, 1).press("Enter");
  assert.equal(await rowTime(page, 1).inputValue(), "00:04.00");
  await rowTime(page, 1).fill("5.25");
  await rowTime(page, 1).press("Control+s");
  await page.getByText("저장됨", { exact: true }).waitFor();
  assert.equal(lastSaved.lyrics[1].startTime, 5.25);
  await undo(page);
  await page.getByText("전체 가사 시각 조정", { exact: true }).click();
  await page.getByRole("button", { name: "전체 가사 0.1초 늦추기", exact: true }).click();
  await save(page);
  assert.deepEqual(
    lastSaved.lyrics.map((l) => l.startTime),
    [0.5, 4.1, 8.1, 13.1],
  );
  await undo(page);
  if (width === 1280) {
    await page.getByRole("button", { name: /^연속 캡처/ }).click();
    await clock(page, 6);
    await page.getByRole("button", { name: "행 시간 캡처", exact: true }).click();
    assert.equal(await row(page, 2).getAttribute("aria-current"), "true");
    await page.getByRole("button", { name: /^연속 캡처/ }).click();
    await undo(page);
    await selectRow(page, 0);
    await page.getByRole("button", { name: "1행 텍스트 수정", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByRole("textbox", { name: "3번째 조각 내용", exact: true }).fill("에코 유지");
    await dialog.getByRole("button", { name: "저장", exact: true }).click();
    await save(page);
    assert.deepEqual(lastSaved.lyrics[0].segments, [
      song.lyrics[0].segments[0],
      song.lyrics[0].segments[1],
      { ...song.lyrics[0].segments[2], text: "에코 유지" },
    ]);
    await undo(page);
    await row(page, 0).getByRole("button", { name: "응원·에코 표시", exact: true }).click();
    await page.getByRole("button", { name: "완료", exact: true }).click();
    await save(page);
    assert.deepEqual(lastSaved.lyrics, song.lyrics, "paint preserves both flags and offsets");
    await page.getByRole("button", { name: "LRC 가져오기", exact: true }).click();
    await page.keyboard.press("e");
    assert.equal(await page.locator("[data-lyric-row]").count(), 4);
    await page.getByRole("textbox", { name: "LRC 가사", exact: true }).fill("[00:02.00]검증 가사");
    await page.getByRole("button", { name: "가져오기", exact: true }).click();
    assert.equal(await page.locator("[data-lyric-row]").count(), 1);
    await undo(page);
    await page.evaluate(() =>
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "e", isComposing: true, bubbles: true }),
      ),
    );
    assert.equal(await page.locator("[data-lyric-row]").count(), 4);
    await page.getByRole("button", { name: "재생", exact: true }).click();
    await page.waitForTimeout(250);
    await page.locator("h1").click();
    await page.keyboard.press("Space");
    assert.equal(await page.evaluate(() => window.__iframe.state), 2);
    await clock(page, 4.1);
    await page.getByRole("button", { name: "다음 행으로 이동", exact: true }).click();
    await page.waitForTimeout(300);
    assert.equal(await page.getByLabel("현재 재생 시각", { exact: true }).innerText(), "00:08.00");
    await rowTime(page, 1).fill("00:04.10");
    await rowTime(page, 1).press("Enter");
    saveStatus = 409;
    await page
      .locator("[data-lyrics-editor] > header")
      .getByRole("button", { name: /^저장/ })
      .click();
    await page.waitForTimeout(200);
    assert.equal(await rowTime(page, 1).inputValue(), "00:04.10");
    assert.ok(await page.getByText("저장하지 않은 변경", { exact: true }).isVisible());
    saveStatus = 200;
  }
  await capture(page, `row-editor-${width}.png`);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  assert.equal(overflow, false);
}

async function verifyAssistant(page) {
  responseMode = "ready";
  await page.goto(origin, { waitUntil: "networkidle" });
  await selectRow(page, 1);

  await page.locator('[data-note-track="extra"]').waitFor();
  await page.waitForTimeout(200);
  const note = page.locator('[data-editor-note="extra:1:1"]');
  if (!(await note.count()))
    await page.getByRole("button", { name: "다음 노트 구간", exact: true }).click();
  await note.click();
  const before = Number(await note.getAttribute("data-note-time"));
  const box = await note.boundingBox();
  await page.mouse.move(box.x + 8, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + 65, box.y + 12, { steps: 5 });
  assert.equal(
    await rowTime(page, 1).inputValue(),
    "00:04.00",
    "preview leaves persisted row alone",
  );
  await page.mouse.up();
  assert.ok(Number(await note.getAttribute("data-note-time")) > before);
  await undo(page);
  assert.equal(Number(await note.getAttribute("data-note-time")), before);
  const original = await note.boundingBox();
  await page.mouse.move(original.x + 8, original.y + 12);
  await page.mouse.down();
  await page.mouse.move(original.x + 60, original.y + 12, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.equal(Number(await note.getAttribute("data-note-time")), before);
  assert.equal(await row(page, 1).getAttribute("aria-current"), "true");
  await page.locator('[data-editor-note="extra:1:0"]').click();
  await note.click({ modifiers: ["Shift"] });
  await page.getByLabel("선택 노트 문구", { exact: true }).fill("같이!");
  await page.getByRole("button", { name: "문구 일괄 적용", exact: true }).click();
  await save(page);
  assert.deepEqual(
    lastSaved.lyrics[1].segments.slice(0, 2).map((s) => s.text),
    ["같이!", "같이!"],
  );
  await undo(page);
  await clock(page, 6);
  await page.getByRole("button", { name: "구간 반복", exact: true }).click();
  await page.getByLabel("반복 시작 초", { exact: true }).fill("4");
  await page.getByLabel("반복 끝 초", { exact: true }).fill("5");
  await page.getByRole("button", { name: "재생", exact: true }).click();
  await page.waitForTimeout(500);
  assert.ok(
    await page.evaluate(() => window.__iframe.time < 5),
    "loop uses YouTube clock and seek",
  );
  await page.getByRole("button", { name: "일시정지", exact: true }).click();
  await page.getByRole("button", { name: "구간 반복", exact: true }).click();
  for (const mode of ["empty", "error"]) {
    responseMode = mode;
    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByText("가사 표와 시간 캡처로 계속 편집할 수 있습니다.", { exact: true })
      .waitFor();

    await clock(page, 12.5);
    await page.getByRole("button", { name: "추임새 노트를 현재 위치에 추가", exact: true }).click();
    assert.equal(
      await page.getByRole("dialog").count(),
      0,
      "adding a note does not interrupt playback with a dialog",
    );
    await page.getByLabel("선택 노트 문구", { exact: true }).fill("보조 입력");
    await page.getByRole("button", { name: "문구 적용", exact: true }).click();
    await save(page);
    assert.ok(
      lastSaved.lyrics.some(
        (line) => line.startTime === 12.5 && line.segments[0].text === "보조 입력",
      ),
    );
    assert.equal(await page.locator("[data-note-inspector],[data-note-table]").count(), 0);
  }
  checks.push({
    rowCaptureAndSegmentOffsetSeparated: true,
    inlineTimeAndShortcutSave: true,
    paintAndTextPreserveFlags: true,
    continuousCaptureUsesRows: true,
    notesSingleUndoAndEscape: true,
    noWaveformNoteEntryWithoutDialog: true,
  });
}

async function verifyFinalWorkflow(page) {
  responseMode = "ready";
  saveStatus = 200;
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator("h1").click();
  for (const time of [20, 20.8, 21.6, 22.4]) {
    await clock(page, time);
    await page.keyboard.press("n");
  }
  assert.equal(await page.getByRole("dialog").count(), 0);
  assert.equal(await page.locator("[data-lyric-row]").count(), 8);
  for (const [index, time] of [20, 20.8, 21.6, 22.4].entries()) {
    await page
      .locator(`[data-editor-note][data-note-time="${time}"]`)
      .click({ modifiers: index ? ["Shift"] : [] });
  }
  await page.getByRole("button", { name: "한 줄로 묶기", exact: true }).click();
  assert.equal(await page.locator("[data-lyric-row]").count(), 5);
  await page.getByLabel("선택 노트 문구", { exact: true }).fill("어이!");
  await page.getByRole("button", { name: "문구 일괄 적용", exact: true }).click();
  await save(page);
  assert.deepEqual(lastSaved.lyrics[4], {
    startTime: 20,
    isExtra: true,
    segments: [0, 0.8, 1.6, 2.4].map((startTimeOffset) => ({
      text: "어이!",
      isCheer: true,
      isEcho: false,
      startTimeOffset,
    })),
  });
  assert.equal(await page.locator("[data-save-state]").getAttribute("data-save-state"), "saved");
  await page.locator("h1").click();
  await page.keyboard.press("ArrowRight");
  await save(page);
  assert.equal(lastSaved.lyrics[4].startTime, 20.01);
  assert.deepEqual(
    lastSaved.lyrics[4].segments.map((s) => s.startTimeOffset),
    [0, 0.8, 1.6, 2.4],
  );
  await undo(page); // nudge
  await undo(page); // batch text
  await undo(page); // group
  assert.equal(await page.locator("[data-lyric-row]").count(), 8);
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  await page.locator('[data-editor-note][data-note-time="22.4"]').click();
  await clock(page, 23.2);
  await page.getByRole("button", { name: "이 줄에 노트 추가", exact: true }).click();
  assert.equal(await page.locator("[data-lyric-row]").count(), 5);
  await page.getByLabel("선택 노트 문구", { exact: true }).fill("마지막 응원!");
  await page.getByRole("button", { name: "문구 적용", exact: true }).click();
  await save(page);
  assert.deepEqual(
    lastSaved.lyrics[4].segments.map((s) => s.startTimeOffset),
    [0, 0.8, 1.6, 2.4, 3.2],
  );
  const long = await page.locator('[data-editor-note][data-note-time="23.2"]').boundingBox();
  const short = await page.locator('[data-editor-note][data-note-time="22.4"]').boundingBox();
  assert.ok(long.width > short.width, "note width follows text");
  const snapshot = structuredClone(lastSaved.lyrics);
  await page.locator("h1").click();
  await page.keyboard.type("qwer");
  await save(page);
  assert.deepEqual(lastSaved.lyrics, snapshot, "old shortcuts do not alter lyrics");
  await capture(page, "final-group-workflow-1280.png");
  checks.push({
    markerEntryWithoutDialog: true,
    groupFourIntoOneLine: true,
    groupUndoRedo: true,
    batchTextAndNudge: true,
    appendKeepsGroup: true,
    contentWidth: true,
    oldShortcutsRemoved: true,
  });
}

async function verifyActual(page, width) {
  responseMode = "ready";
  await page.goto(origin + "/?actual", { waitUntil: "networkidle" });
  await save(page);
  assert.deepEqual(lastSaved.lyrics, actualLyrics);
  await selectRow(page, 1);
  if (width === 390) await page.getByRole("button", { name: "파형 축소", exact: true }).click();
  await page.waitForTimeout(150);
  for (const [index, time] of [4, 4.8, 5.6, 6.4].entries()) {
    await page
      .locator(`[data-editor-note][data-note-time="${time}"]`)
      .click({ modifiers: index ? ["Shift"] : [] });
  }
  await capture(page, `final-editor-${width}.png`);
  const preview = await page
    .locator("[data-preview-time]")
    .evaluateAll((nodes) =>
      nodes.map((n) => ({ time: Number(n.dataset.previewTime), left: parseFloat(n.style.left) })),
    );
  for (const time of [4, 4.8, 5.6, 6.4])
    assert.ok(
      preview.some(
        (item) => Math.abs(item.time - time) < 0.001 && Math.abs(item.left - time * 150) < 0.01,
      ),
    );
  await selectRow(page, 5);
  assert.equal(
    await row(page, 5).locator('[data-seg="1"]').textContent(),
    actualLyrics[5].segments[1].text,
  );
  assert.ok(
    await row(page, 5)
      .locator('[data-seg="1"]')
      .evaluate((el) => {
        const parent = el.parentElement.getBoundingClientRect();
        return [...el.getClientRects()].every(
          (r) =>
            r.left >= parent.left - 1 &&
            r.right <= parent.right + 1 &&
            r.bottom <= parent.bottom + 1,
        );
      }),
    "mixed echo stays visible within lyric text column",
  );
  await capture(page, `actual-row-editor-${width}.png`);
  await page.getByRole("button", { name: "6행 텍스트 수정", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox", { name: "2번째 조각 내용", exact: true })
    .fill(actualLyrics[5].segments[1].text + "!");
  await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
  await save(page);
  const expected = structuredClone(actualLyrics);
  expected[5].segments[1].text += "!";
  assert.deepEqual(lastSaved.lyrics, expected);
  await undo(page);
  if (width === 1280) {
    await selectRow(page, 1);
    await row(page, 1).getByRole("button", { name: "응원·에코 표시", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "에코", exact: true }).click();
    await page.locator('[data-char-idx="5"]').click();
    await page.getByRole("button", { name: "완료", exact: true }).click();
    await save(page);
    const pieces = lastSaved.lyrics[1].segments.filter((s) => s.startTimeOffset === 0.8);
    assert.equal(pieces.length, 3);
    assert.equal(pieces.map((s) => s.text).join(""), actualLyrics[1].segments[1].text);
    await page.goto(origin + "/viewer?saved", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "영상 재생", exact: true }).click();
    await clock(page, 4.81);
    const segments = page
      .getByRole("region", { name: "응원법 가사" })
      .getByRole("button")
      .nth(1)
      .locator("[data-lyric-segment]");
    for (const index of [1, 2, 3])
      assert.equal(
        await segments.nth(index).evaluate((el) => getComputedStyle(el).textDecorationLine),
        "underline",
      );
    await page.goto(origin + "/?actual", { waitUntil: "networkidle" });
    await selectRow(page, 1);
    await page.getByRole("spinbutton", { name: "2행 2번째 조각 오프셋", exact: true }).fill("2.5");
    await rowTime(page, 4).fill("00:20.00");
    await rowTime(page, 4).press("Enter");
    await save(page);
    await page.goto(origin + "/viewer?saved", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "영상 재생", exact: true }).click();
    await clock(page, 6.51);
    const lines = page.getByRole("region", { name: "응원법 가사" }).getByRole("button");
    assert.equal(
      await lines
        .nth(1)
        .locator("[data-lyric-segment]")
        .nth(1)
        .evaluate((el) => getComputedStyle(el).textDecorationLine),
      "underline",
    );
    await clock(page, 20.1);
    assert.equal(await lines.nth(4).getAttribute("aria-current"), "true");
  }
  checks.push({
    width,
    legacyRowEditingPreserved: true,
    duplicateEditorsAbsent: true,
    actualTextMetadataPreserved: true,
  });
}

try {
  for (const width of [1600, 1280, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
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
    await verifyRows(page, width);
    if (width === 1280) {
      await verifyAssistant(page);
      await verifyFinalWorkflow(page);
    }
    await verifyActual(page, width);
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
