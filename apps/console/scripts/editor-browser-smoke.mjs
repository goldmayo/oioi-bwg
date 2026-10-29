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
    window.scrollTo(0, 0);
    for (const element of document.querySelectorAll("main,[data-editor-scroll]"))
      element.scrollTop = 0;
  });
  await page.screenshot({ path: join(out, name), fullPage: true });
};

async function verifyNotes(page, width) {
  responseMode = "ready";
  saveStatus = 200;
  await page.goto(origin, { waitUntil: "networkidle" });
  await page.locator('[aria-label="확대 파형과 Cue"] canvas').first().waitFor();
  await page.waitForTimeout(150);
  assert.equal(await page.locator("[data-note-track]").count(), 2);
  assert.equal(await page.locator("[data-note-table] tbody tr").count(), 7);
  const wave = page.locator('[aria-label="확대 파형과 Cue"]');
  const track = page.locator('[data-note-track="extra"]');
  const [waveBox, trackBox] = await Promise.all([wave.boundingBox(), track.boundingBox()]);
  assert.ok(Math.abs(waveBox.x - trackBox.x) < 1 && Math.abs(waveBox.width - trackBox.width) < 1);
  const note = page.locator('[data-editor-note="extra:1:1"]');
  if (!(await note.count())) {
    await page.getByRole("button", { name: "다음 노트 구간", exact: true }).click();
  }
  await note.click();
  await capture(page, `notes-${width}.png`);
  if (width === 390) {
    await page.getByRole("button", { name: "선택 노트 속성", exact: true }).click();
    await page.screenshot({ path: join(out, "notes-mobile-properties.png"), fullPage: true });
    await page.getByRole("button", { name: "노트 트랙으로 돌아가기", exact: true }).click();
  }
  if (width !== 1600) return;
  const range = await wave.evaluate((el) => ({
    start: Number(el.dataset.start),
    end: Number(el.dataset.end),
  }));
  // 실제 접근성 이름은 사용자 문구 '추가 응원'을 사용한다.
  const draw = page.getByRole("button", { name: "추가 응원 트랙에 노트 추가", exact: true });
  const drawBox = await draw.boundingBox();
  await draw.click({
    position: { x: ((9 - range.start) / (range.end - range.start)) * drawBox.width, y: 45 },
  });
  assert.equal(await page.locator("[data-note-table] tbody tr").count(), 8);
  await page.getByRole("button", { name: /^저장/ }).click();
  await page.getByText("가사와 노트의 내용·시각을 확인해 주세요.", { exact: true }).waitFor();
  await page.getByRole("textbox", { name: "선택 노트 내용", exact: true }).fill("수동 입력");
  await page.getByRole("button", { name: "노트 0.5초 뒤에 복제", exact: true }).click();
  assert.equal(await page.locator("[data-note-table] tbody tr").count(), 9);
  await page.getByRole("button", { name: "선택 노트 삭제", exact: true }).click();
  assert.equal(await page.locator("[data-note-table] tbody tr").count(), 8);
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  assert.equal(await page.locator("[data-note-table] tbody tr").count(), 9);
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  assert.equal(await page.locator("[data-note-table] tbody tr").count(), 8);
  await note.click();
  await note.scrollIntoViewIfNeeded();
  const box = await note.boundingBox();
  const before = Number(await note.getAttribute("data-note-time"));
  await page.mouse.move(box.x + 10, box.y + 12);
  await page.mouse.down();
  await page.mouse.move(box.x + 70, box.y + 12, { steps: 6 });
  assert.equal(
    Number(await page.locator('[data-editor-note="extra:1:0"]').getAttribute("data-note-time")),
    4,
  );
  const preview = Number(await note.getAttribute("data-note-time"));
  assert.ok(preview > before);
  await page.mouse.up();
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  assert.equal(Number(await note.getAttribute("data-note-time")), before);
  await note.scrollIntoViewIfNeeded();
  const original = await note.boundingBox();
  await page.mouse.move(original.x + 10, original.y + 10);
  await page.mouse.down();
  await page.mouse.move(original.x + 65, original.y + 10, { steps: 4 });
  await page.keyboard.press("Escape");
  await page.mouse.up();
  assert.equal(Number(await note.getAttribute("data-note-time")), before);
  await page.getByRole("button", { name: "노트 10ms 늦추기", exact: true }).click();
  assert.equal(
    Number(await note.getAttribute("data-note-time")),
    Math.round((before + 0.01) * 100) / 100,
  );
  const cheer = page.getByRole("checkbox", { name: "2번째 조각 응원 강조", exact: true });
  const echo = page.getByRole("checkbox", { name: "2번째 조각 에코 강조", exact: true });
  assert.equal(await cheer.isChecked(), true);
  assert.equal(await echo.isChecked(), false);
  await echo.check();
  assert.equal(await cheer.isChecked(), true);
  await page.getByRole("button", { name: "실행 취소", exact: true }).click();
  assert.equal(await cheer.isChecked(), true);
  assert.equal(await echo.isChecked(), false);
  await page.getByRole("button", { name: "다시 실행", exact: true }).click();
  assert.equal(await cheer.isChecked(), true);
  assert.equal(await echo.isChecked(), true);
  const count = await page.locator("[data-note-table] tbody tr").count();
  await echo.press("e");
  assert.equal(await page.locator("[data-note-table] tbody tr").count(), count);
  await capture(page, "notes-flags-extra.png");
  await page.getByRole("button", { name: /^저장/ }).click();
  await page.getByText("저장됨", { exact: true }).waitFor();
  assert.equal(lastSaved.lyrics[1].segments[1].isCheer, true);
  assert.equal(lastSaved.lyrics[1].segments[1].isEcho, true);
  await page.getByRole("button", { name: "1번 노트 선택", exact: true }).click();
  assert.equal(
    await page.getByRole("checkbox", { name: "2번째 조각 응원 강조", exact: true }).isChecked(),
    true,
  );
  assert.equal(
    await page.getByRole("checkbox", { name: "3번째 조각 에코 강조", exact: true }).isChecked(),
    true,
  );
  await page
    .getByRole("textbox", { name: "선택 노트 3번째 조각 내용", exact: true })
    .fill("에코 유지");
  await capture(page, "notes-flags-mixed.png");
  const extra = page.getByRole("checkbox", { name: "추가 응원 행", exact: true });
  await extra.check();
  await extra.uncheck();
  await page.getByRole("button", { name: /^저장/ }).click();
  await page.getByText("저장됨", { exact: true }).waitFor();
  assert.equal(lastSaved.lyrics[0].isExtra, false);
  assert.deepEqual(lastSaved.lyrics[0].segments, [
    song.lyrics[0].segments[0],
    song.lyrics[0].segments[1],
    { ...song.lyrics[0].segments[2], text: "에코 유지" },
  ]);
  assert.ok(
    lastSaved.lyrics.every((line) =>
      line.segments.every((segment) => !("segmentIndex" in segment)),
    ),
  );
  assert.ok(
    lastSaved.lyrics.some((line) => line.segments.some((segment) => segment.text === "수동 입력")),
  );
  for (const mode of ["empty", "error"]) {
    responseMode = mode;
    await page.reload({ waitUntil: "networkidle" });
    await page
      .getByText("가사 표와 시간 캡처로 계속 편집할 수 있습니다.", { exact: true })
      .waitFor();
    assert.equal(await page.locator("canvas").count(), 0);
    await page.evaluate(() => {
      window.__iframe.time = 12.5;
    });
    await page.waitForTimeout(150);
    await page
      .getByRole("button", { name: "추가 응원 노트를 현재 위치에 추가", exact: true })
      .click();
    assert.equal(
      await page.getByRole("spinbutton", { name: "노트 시작 시각", exact: true }).inputValue(),
      "12.5",
    );
    await page.getByRole("textbox", { name: "선택 노트 내용", exact: true }).fill("파형 없는 입력");
    const visible = await page
      .locator("[data-piano-roll]")
      .evaluate((el) => ({ start: Number(el.dataset.noteStart), end: Number(el.dataset.noteEnd) }));
    assert.ok(visible.start <= 12.5 && visible.end > 12.5);
    assert.equal(Math.round((visible.end - visible.start) * 100) / 100, 8);
    assert.equal(await page.evaluate(() => window.__iframe.getCurrentTime()), 12.5);
    assert.ok(await page.getByRole("button", { name: /노트 파형 없는 입력/ }).count());
    await capture(page, `notes-${mode}.png`);
    assert.equal(await page.locator("[data-note-table] tbody tr").count(), 8);
  }
  checks.push({
    noteTracksAligned: true,
    emptyDraftBlockedOnSave: true,
    noteDrawAndText: true,
    duplicateDeleteUndo: true,
    noteDragSingleUndo: true,
    noteEscapeCancel: true,
    fineNudge10ms: true,
    savesLegacyJson: true,
    noWaveformNoteInput: true,
    pausedClockCapture: true,
    selectedNoteRevealedWithoutSeeking: true,
    segmentEmphasisVisibleAndEditable: true,
    independentCheerEchoUndoRedo: true,
    mixedSegmentsAndOffsetsRoundTrip: true,
    extraFlagRoundTrip: true,
  });
}

async function verifyActualLyrics(page, width) {
  responseMode = "empty";
  saveStatus = 200;
  await page.goto(origin + "/?actual", { waitUntil: "networkidle" });
  const select = async (id) => {
    await page
      .locator(`[data-note-id="${id}"]`)
      .locator("xpath=..")
      .getByRole("button", { name: /번 노트 선택/ })
      .click();
  };
  const check = (value, message) => {
    if (!value) regressions.push(`${width}: ${message}`);
  };
  const color = (locator) => locator.evaluate((el) => getComputedStyle(el).color);
  assert.equal(await page.locator("[data-note-table] tbody tr").count(), 68);
  await page.getByRole("button", { name: /^저장/ }).click();
  await page.getByText("저장됨", { exact: true }).waitFor();
  assert.deepEqual(lastSaved.lyrics, actualLyrics, "unchanged real lyrics must round-trip exactly");
  const echoColor = await color(page.locator('[data-note-id="line:0"] input'));
  await select("line:5");
  const mixed = page.locator('[data-note-id="line:5"]');
  assert.equal(
    await mixed.locator('[data-seg="1"]').textContent(),
    actualLyrics[5].segments[1].text,
  );
  await page.evaluate(() => window.__dismissToasts());
  await page.waitForTimeout(200);
  await capture(page, `actual-editor-mixed-${width}.png`);
  if (width === 390) {
    await page.getByRole("button", { name: "선택 노트 속성", exact: true }).click();
    await page.screenshot({ path: join(out, "actual-mobile-properties.png"), fullPage: true });
    await page.getByRole("button", { name: "노트 트랙으로 돌아가기", exact: true }).click();
  }
  const extraColor = await color(page.locator('[data-note-id="extra:1:0"] [data-seg="0"]'));
  // The preview must place each of the four real '어이!' cues .8 s apart.
  await page.getByText("실시간 응원 미리보기", { exact: true }).click();
  const preview = page
    .locator("details")
    .filter({ has: page.getByText("실시간 응원 미리보기", { exact: true }) });
  const positions = await preview.locator("span").evaluateAll((nodes) =>
    nodes
      .filter((n) => n.childElementCount === 0 && n.textContent.trim() === "어이!")
      .slice(0, 4)
      .map((n) => n.getBoundingClientRect().x),
  );
  check(
    positions.length === 4 && positions.every((v, i) => Math.abs(v - positions[0] - i * 120) < 1),
    "preview ignores .8/1.6/2.4 offsets",
  );
  await page.getByText("실시간 응원 미리보기", { exact: true }).click();
  if (width === 1280) {
    await page.locator("[data-lyric-details] summary").click();
    await page.getByRole("button", { name: "6행 텍스트 수정", exact: true }).click();
    await page
      .getByRole("textbox", { name: "2번째 조각 내용", exact: true })
      .fill(actualLyrics[5].segments[1].text + "!");
    await page.getByRole("dialog").getByRole("button", { name: "저장", exact: true }).click();
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/save") && r.request().method() === "POST"),
      page.getByRole("button", { name: /^저장/ }).click(),
    ]);
    const expected = structuredClone(actualLyrics);
    expected[5].segments[1].text += "!";
    assert.deepEqual(
      lastSaved.lyrics,
      expected,
      "raw text edit preserves every other segment and property",
    );
    await page.getByRole("button", { name: "실행 취소", exact: true }).click();
    await page.getByRole("button", { name: "3번 노트 강조 편집", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "에코", exact: true }).click();
    await page.locator('[data-char-idx="5"]').click();
    await page.getByRole("button", { name: "완료", exact: true }).click();
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith("/save") && r.request().method() === "POST"),
      page.getByRole("button", { name: /^저장/ }).click(),
    ]);
    const pieces = lastSaved.lyrics[1].segments.filter((s) => s.startTimeOffset === 0.8);
    assert.equal(pieces.length, 3);
    assert.equal(pieces.map((s) => s.text).join(""), actualLyrics[1].segments[1].text);
    assert.equal("startTimeOffset" in lastSaved.lyrics[1].segments[0], false);
    await page.goto(origin + "/viewer?saved", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "영상 재생", exact: true }).click();
    await page.evaluate(() => {
      window.__iframe.time = 4.81;
    });
    await page.waitForTimeout(100);
    const piecesInViewer = page
      .getByRole("region", { name: "응원법 가사" })
      .getByRole("button")
      .nth(1)
      .locator("[data-lyric-segment]");
    for (const index of [1, 2, 3])
      assert.equal(
        await piecesInViewer.nth(index).evaluate((el) => getComputedStyle(el).textDecorationLine),
        "underline",
      );
    const rects = await piecesInViewer.evaluateAll((nodes) =>
      nodes.slice(1, 4).map((el) => ({
        left: el.getBoundingClientRect().left,
        right: el.getBoundingClientRect().right,
      })),
    );
    assert.ok(
      rects.slice(1).every((box, i) => Math.abs(box.left - rects[i].right) < 1),
      "pieces of one cue render as one word",
    );
    await capture(page, "actual-viewer-split-call-1280.png");
    checks.push({
      actualMixedTextSavePreservesMetadata: true,
      actualPaintPiecesKeepOffset: true,
      sameCuePiecesRenderTogether: true,
    });
    await page.goto(origin + "/?actual", { waitUntil: "networkidle" });
    await select("extra:1:1");
    await page.getByRole("spinbutton", { name: "노트 시작 시각", exact: true }).fill("6.5");
    await select("line:4");
    await page.getByRole("spinbutton", { name: "노트 시작 시각", exact: true }).fill("20");
    await page.getByRole("button", { name: /^저장/ }).click();
    await page.getByText("저장됨", { exact: true }).waitFor();
  }
  await page.goto(origin + "/viewer" + (width === 1280 ? "?saved" : ""), {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "영상 재생", exact: true }).click();
  const lines = page.getByRole("region", { name: "응원법 가사" }).getByRole("button");
  assert.equal(await lines.count(), 41);
  const publicEcho = await color(lines.nth(0).locator("[data-lyric-segment]"));
  const publicExtra = await color(lines.nth(1).locator("[data-lyric-segment]").first());
  check(echoColor === publicEcho, `editor echo ${echoColor} differs from viewer ${publicEcho}`);
  check(
    extraColor === publicExtra,
    `editor extra ${extraColor} differs from viewer ${publicExtra}`,
  );
  await page.evaluate(() => {
    window.__iframe.time = 19.8;
  });
  await page.waitForTimeout(100);
  assert.equal(
    await lines.nth(5).locator("[data-lyric-segment]").nth(1).textContent(),
    actualLyrics[5].segments[1].text,
  );
  await capture(page, `actual-viewer-mixed-${width}.png`);
  if (width === 1280) {
    await page.evaluate(() => {
      window.__iframe.time = 6.51;
    });
    await page.waitForTimeout(100);
    check(
      (await lines
        .nth(1)
        .locator(":scope>span>span")
        .nth(1)
        .evaluate((el) => getComputedStyle(el).textDecorationLine)) === "underline",
      "moved extra cue at6.5 does not activate in viewer",
    );
    await page.evaluate(() => {
      window.__iframe.time = 20.1;
    });
    await page.waitForTimeout(100);
    check(
      (await lines.nth(4).getAttribute("aria-current")) === "true",
      "moved lyric row at20 loses to array order in viewer",
    );
  }
}

try {
  for (const width of [1600, 1280, 390]) {
    responseMode = "ready";
    saveStatus = 200;
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    await page.route(/^https:\/\/(?:img\.youtube\.com|i\.ytimg\.com)\//, (route) =>
      route.fulfill({
        contentType: "image/gif",
        body: Buffer.from("R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==", "base64"),
      }),
    );
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (message) => {
      const expectedFailure =
        /^Failed to load resource:.*(?:409|500)/.test(message.text()) &&
        /\/(save|api\/admin\/songs\/)/.test(message.location().url);
      if (message.type() === "error" && !expectedFailure)
        errors.push(message.text() + " " + message.location().url);
    });
    await page.goto(origin, { waitUntil: "networkidle" });
    await page.locator('[aria-label="확대 파형과 Cue"] canvas').first().waitFor();
    await page.getByRole("button", { name: "선택", exact: true }).click();
    await page.locator("[data-lyric-details] summary").click();
    await page.getByRole("button", { name: "2행 선택", exact: true }).click();
    await page.waitForTimeout(200);
    assert.ok(
      (await page.locator("canvas").count()) >= 2,
      JSON.stringify({ errors, text: await page.locator("body").innerText() }),
    );
    assert.equal(
      await page.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    await capture(page, `editor-${width}.png`);
    if (width === 390) {
      await page.getByRole("button", { name: "2행 선택", exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole("textbox", { name: "2행 1번째 조각 텍스트", exact: true }).fill("");
      await page.screenshot({ path: join(out, "editor-mobile-table.png"), fullPage: true });
    }
    if (width === 1600) {
      const canvas = page.locator('[aria-label="확대 파형과 Cue"]');
      const box = await canvas.boundingBox();
      const range = await canvas.evaluate((el) => ({
        start: Number(el.dataset.start),
        end: Number(el.dataset.end),
      }));
      const x = box.x + ((4 - range.start) / (range.end - range.start)) * box.width + 15,
        y = box.y + box.height - 40;
      const before = await page
        .getByRole("textbox", { name: "2행 시작 시각", exact: true })
        .inputValue();
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 65, y, { steps: 8 });
      await page.waitForTimeout(100);
      assert.equal(
        await page.getByRole("textbox", { name: "2행 시작 시각", exact: true }).inputValue(),
        before,
      );
      await capture(page, "editor-drag.png");
      await page.mouse.up();
      await page.waitForTimeout(100);
      assert.notEqual(
        await page.getByRole("textbox", { name: "2행 시작 시각", exact: true }).inputValue(),
        before,
      );
      await page.getByRole("button", { name: "실행 취소", exact: true }).click();
      assert.equal(
        await page.getByRole("textbox", { name: "2행 시작 시각", exact: true }).inputValue(),
        before,
      );
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.mouse.move(x + 55, y, { steps: 5 });
      await page.keyboard.press("Escape");
      await page.mouse.up();
      assert.equal(
        await page.getByRole("textbox", { name: "2행 시작 시각", exact: true }).inputValue(),
        before,
      );
      const input = page.getByRole("textbox", { name: "참고 영상", exact: true });
      await input.focus();
      await page.keyboard.type("qwer");
      assert.equal(await page.locator("[data-lyric-row]").count(), 4);
      await input.fill(song.youtubeId);
      await input.blur();
      await page.getByRole("button", { name: "LRC 가져오기", exact: true }).click();
      await page.keyboard.press("e");
      assert.equal(await page.locator("[data-lyric-row]").count(), 4);
      await page.keyboard.press("Escape");
      await page.getByRole("button", { name: "재생", exact: true }).click();
      await page.waitForTimeout(250);
      await page.keyboard.press("w");
      assert.equal(await page.evaluate(() => window.__iframe.getPlayerState()), 2);
      await page.getByRole("button", { name: "다음 Cue로 이동", exact: true }).click();
      await page.waitForTimeout(300);
      assert.equal(
        await page.getByLabel("현재 재생 시각", { exact: true }).innerText(),
        "00:08.00",
      );
      await page.evaluate(() => {
        window.__iframe.time = 9.25;
      });
      await page.waitForTimeout(150);
      await page.keyboard.press("q");
      assert.equal(
        await page.getByRole("textbox", { name: "3행 시작 시각", exact: true }).inputValue(),
        "00:09.25",
      );
      await page.getByRole("button", { name: "실행 취소", exact: true }).click();
      await page.keyboard.press("e");
      assert.equal(await page.locator("[data-lyric-row]").count(), 5);
      await page.getByRole("button", { name: "실행 취소", exact: true }).click();
      await page.evaluate(() =>
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "e", isComposing: true, bubbles: true }),
        ),
      );
      assert.equal(await page.locator("[data-lyric-row]").count(), 4);
      await page.keyboard.press("r");
      assert.equal(
        await page.getByRole("button", { name: /R 연속 캡처/ }).getAttribute("aria-pressed"),
        "true",
      );
      await page.keyboard.press("r");
      await page.getByRole("button", { name: "LRC 가져오기", exact: true }).click();
      await page
        .getByRole("textbox", { name: "LRC 가사", exact: true })
        .fill("[00:02.00]검증 가사");
      await page.getByRole("button", { name: "가져오기", exact: true }).click();
      assert.equal(await page.locator("[data-lyric-row]").count(), 1);
      await page.getByRole("button", { name: "실행 취소", exact: true }).click();
      assert.equal(await page.locator("[data-lyric-row]").count(), 4);
      await page.getByRole("button", { name: "2행 선택", exact: true }).click();
      await page.getByRole("button", { name: "선택 행 0.1초 늦추기", exact: true }).click();
      const draft = await page
        .getByRole("textbox", { name: "2행 시작 시각", exact: true })
        .inputValue();
      saveStatus = 409;
      await page.getByRole("button", { name: /^저장/ }).click();
      await page.waitForTimeout(200);
      assert.equal(
        await page.getByRole("textbox", { name: "2행 시작 시각", exact: true }).inputValue(),
        draft,
      );
      assert.ok(await page.getByText("저장하지 않은 변경", { exact: true }).isVisible());
      for (const mode of ["empty", "error"]) {
        responseMode = mode;
        await page.reload({ waitUntil: "networkidle" });
        await page
          .getByText("가사 표와 시간 캡처로 계속 편집할 수 있습니다.", { exact: true })
          .waitFor();
        assert.equal(await page.locator("canvas").count(), 0);
        assert.equal(await page.locator("[data-lyric-row]").count(), 4);
        await capture(page, `editor-${mode}.png`);
      }
      checks.push({
        dragCommitsOnce: true,
        escapeCancels: true,
        actualClockPlaybackSeekCapture: true,
        extraRowRecordingAndLrcUndo: true,
        imeBlocksShortcuts: true,
        inputAndDialogBlockShortcuts: true,
        failedSaveKeepsDraft: true,
        emptyAndErrorKeepEditor: true,
      });
    }
    await verifyNotes(page, width);
    await verifyActualLyrics(page, width);
    assert.equal(errors.length, 0, errors.join("\n"));
    checks.push({ width, overflow: false, errors });
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
    const expectedNotes = source.lyrics.reduce(
      (n, line) => n + (line.isExtra ? line.segments.length : 1),
      0,
    );
    assert.equal(
      await corpusPage.locator("[data-note-table] tbody tr").count(),
      expectedNotes,
      source.title,
    );
    const editorColors = await corpusPage
      .locator("[data-note-table] [data-line][data-seg]")
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
      notes: expectedNotes,
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
