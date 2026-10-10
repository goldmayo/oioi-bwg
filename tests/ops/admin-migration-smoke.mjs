import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { chromium } from "playwright";
import postgres from "postgres";

import {
  enrollConsoleFixture,
  fixtureKey,
  loginConsole,
  changeConsoleAccess,
  assertConsoleSessionBoundary,
  assertConsoleLogsSafe,
} from "./console-mfa-smoke.mjs";

// 운영/복원 DB에서 fixture를 만들지 않는다. 기존 runner가 생성한 격리 DB만 허용한다.
for (const name of ["DATABASE_URL", "M7_TEST_POSTGRES_VERIFICATION_URL"]) {
  const url = new URL(process.env[name] ?? "");
  assert.ok(["localhost", "127.0.0.1"].includes(url.hostname));
  assert.ok(url.pathname.startsWith("/oioi_m7_test_"));
}
const sql = postgres(process.env.M7_TEST_POSTGRES_VERIFICATION_URL, { max: 1 });
const artifacts =
  process.env.P04_ARTIFACT_DIR ?? fs.mkdtempSync(path.join(os.tmpdir(), "oioi-p04-smoke-"));
fs.mkdirSync(artifacts, { recursive: true });
const password = "P04-fixture-pass1!";
const passwordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$cDA0LWJyb3dzZXItZml4dHVyZS1zYWx0$B2TTF8IxGl6mwC9jStRh3/z88pnDsCMwg9Ft8nslGpY";
const processes = [];
let browser;

async function start(app, port) {
  const origin = `http://127.0.0.1:${port}`;
  const log = fs.openSync(path.join(artifacts, `${app}.log`), "w");
  const child = spawn(process.execPath, [`apps/${app}/.next/standalone/apps/${app}/server.js`], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: String(port),
      DATABASE_URL: process.env.DATABASE_URL,
      NEXT_PUBLIC_APP_ENV: "staging",
      ...(app === "web"
        ? { AUTH_SECRET: "p04-web-private-browser-fixture-secret", AUTH_TRUST_HOST: "true" }
        : {
            CONSOLE_AUTH_SECRET: "p04-console-private-browser-fixture-secret",
            CONSOLE_ORIGIN: origin,
            CONSOLE_MFA_ENCRYPTION_KEY: fixtureKey,
          }),
    },
    stdio: ["ignore", log, log],
  });
  fs.closeSync(log);
  processes.push(child);
  child.on("error", (error) => console.error(`${app} startup failed: ${error.message}`));
  for (let attempt = 0; attempt < 100; attempt++) {
    assert.equal(child.exitCode, null, `${app} exited before readiness`);
    try {
      if ((await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(500) })).ok)
        return origin;
    } catch {
      /* 서버 시작 대기 */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${app} startup timeout; see ${artifacts}`);
}

async function login(context, origin, email = "admin@p04.example.test") {
  const page = await context.newPage();
  if (origin === origins.console) {
    await loginConsole(context, origin, sql, email);
    await page.goto(`${origin}/admin/albums`);
    return page;
  }
  await page.goto(`${origin}/admin-login`);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(`${origin}/admin/albums`);
  return page;
}

async function saveDialog(page, name, button, endpoint) {
  const response = page.waitForResponse(
    (r) => r.url().includes(endpoint) && ["POST", "PATCH"].includes(r.request().method()),
  );
  await page
    .getByRole("dialog", { name, exact: true })
    .getByRole("button", { name: button, exact: true })
    .click();
  const saved = await response;
  assert.ok(saved.ok(), `${name}: HTTP ${saved.status()}`);
  await page.getByRole("dialog", { name, exact: true }).waitFor({ state: "hidden" });
  return saved.json();
}

async function journey(origin, label) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  context.on("page", (page) => page.on("pageerror", (error) => errors.push(error.message)));
  // 외부 영상만 deterministic provider fixture로 격리한다. 앱/API/Auth/PostgreSQL은 실제 실행한다.
  await context.addInitScript(() => {
    window.YT = {
      PlayerState: { PLAYING: 1 },
      Player: class {
        constructor(_element, options) {
          this.videoId = options.videoId;
          this.options = options;
          this.time = options.videoId === "abcdefghijk" ? 3.25 : 8.5;
          setTimeout(() => {
            options.events.onReady({ target: this });
            this.playVideo();
          }, 0);
        }
        getCurrentTime() {
          return this.time;
        }
        getDuration() {
          return this.videoId === "abcdefghijk" ? 120 : 240;
        }
        getVideoData() {
          return { video_id: this.videoId };
        }
        getPlayerState() {
          return 1;
        }
        playVideo() {
          this.options.events.onStateChange({ target: this, data: 1 });
        }
        pauseVideo() {
          this.options.events.onStateChange({ target: this, data: 2 });
        }
        seekTo(time) {
          this.time = time;
        }
        destroy() {}
      },
    };
  });
  await context.route(/^https:\/\//, (route) => route.abort());
  const page = await login(context, origin);
  const albumName = `P04 ${label} album`;
  await page.getByRole("button", { name: "앨범 추가", exact: true }).click();
  await page.getByLabel("앨범 이름", { exact: true }).fill(albumName);
  await page.getByLabel("Slug", { exact: true }).fill(`p04-${label}-album`);
  await page.getByLabel("앨범 이미지", { exact: true }).fill("https://example.invalid/p04.webp");
  const album = await saveDialog(page, "앨범 추가", "추가", "/api/admin/albums");
  const albumRow = page.getByRole("row").filter({ hasText: albumName });
  await albumRow.waitFor();
  await albumRow.getByTitle("수정", { exact: true }).click();
  await page.getByLabel("앨범 이름", { exact: true }).fill(`${albumName} edited`);
  await saveDialog(page, "앨범 수정", "수정", "/api/admin/albums");
  await page
    .getByRole("row")
    .filter({ hasText: `${albumName} edited` })
    .waitFor();

  await page
    .getByRole("row")
    .filter({ hasText: `${albumName} edited` })
    .getByTitle("수정", { exact: true })
    .click();
  assert.equal(
    await page.getByLabel("앨범 이름", { exact: true }).inputValue(),
    `${albumName} edited`,
  );
  await page.screenshot({
    path: path.join(artifacts, `${label}-album-reopened.png`),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("dialog", { name: "앨범 수정", exact: true })
    .getByRole("button", { name: "취소", exact: true })
    .click();

  await page.goto(`${origin}/admin/songs`);
  await page.getByRole("button", { name: "곡 추가", exact: true }).click();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: `${albumName} edited`, exact: true }).click();
  const songTitle = `P04 ${label} song`;
  await page.getByLabel("곡 제목", { exact: true }).fill(songTitle);
  await page.getByLabel("Slug", { exact: true }).fill(`p04-${label}-song`);
  await page.getByLabel("YouTube ID", { exact: true }).fill("abcdefghijk");
  await page.locator('input[type="file"]').setInputFiles({
    name: "p04.lrc",
    mimeType: "text/plain",
    buffer: Buffer.from("[00:01.00]첫 가사\n[00:02.00]둘째 가사"),
  });
  await page.getByText("p04.lrc", { exact: true }).waitFor();
  const song = await saveDialog(page, "곡 추가", "추가", "/api/admin/songs");
  const songRow = page.getByRole("row").filter({ hasText: songTitle });
  await songRow.waitFor();
  await songRow.getByTitle("수정", { exact: true }).click();
  await page.getByLabel("곡 제목", { exact: true }).fill(`${songTitle} edited`);
  await saveDialog(page, "곡 수정", "수정", "/api/admin/songs");
  await page
    .getByRole("row")
    .filter({ hasText: `${songTitle} edited` })
    .getByTitle("수정", { exact: true })
    .click();
  assert.equal(
    await page.getByLabel("곡 제목", { exact: true }).inputValue(),
    `${songTitle} edited`,
  );
  await page.screenshot({
    path: path.join(artifacts, `${label}-song-reopened.png`),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("dialog", { name: "곡 수정", exact: true })
    .getByRole("button", { name: "취소", exact: true })
    .click();
  await page.getByRole("link", { name: `${songTitle} edited`, exact: true }).click();
  await page.getByRole("button", { name: "저장 (Ctrl+S)", exact: true }).waitFor();
  await page.getByRole("button", { name: "LRC Import", exact: true }).click();
  await page
    .getByRole("dialog")
    .getByRole("textbox")
    .fill("[00:03.00]이관 검증 가사\n[00:04.00]두번째 행");
  await page.getByRole("button", { name: "적용하기", exact: true }).click();
  await page.getByRole("button", { name: "+0.1s", exact: true }).first().click();
  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await page.getByText("00:03.25", { exact: true }).first().waitFor();
  await page.getByPlaceholder("URL 또는 ID 붙여넣기").fill("lmnopqrstuv");
  await page.getByText("00:08.50", { exact: true }).first().waitFor();
  await page.getByTitle("타임스탬프 동기화 (SYNC)", { exact: true }).first().click();
  const response = page.waitForResponse(
    (r) =>
      r.url().endsWith(`/api/admin/songs/${song.id}/lyrics`) && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "저장 (Ctrl+S)", exact: true }).click();
  const saved = await response;
  assert.ok(saved.ok());
  const [row] = await sql`select lyrics from "Song" where id = ${song.id}`;
  assert.equal(row.lyrics[0].startTime, 8.5);
  assert.equal(row.lyrics[1].startTime, 4.1);
  assert.equal(row.lyrics[0].segments[0].text, "이관 검증 가사");
  await page.reload();
  await page.getByText("이관 검증 가사", { exact: true }).first().waitFor();
  await page.screenshot({ path: path.join(artifacts, `${label}-editor.png`), fullPage: true });
  const cookies = await context.cookies();
  assert.ok(
    cookies.some((cookie) =>
      cookie.name.startsWith(
        label === "console" ? "oioi-console.session-token" : "authjs.session-token",
      ),
    ),
  );

  if (label === "console") {
    const draftId = "wxyz1234567";
    const draftInput = page.getByPlaceholder("URL 또는 ID 붙여넣기");
    const saveButton = page.getByRole("button", { name: "저장 (Ctrl+S)", exact: true });
    await draftInput.fill(draftId);
    await changeConsoleAccess(sql, "USER");
    const rejected = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/admin/songs/${song.id}/lyrics`) && r.request().method() === "PATCH",
    );
    await saveButton.click();
    assert.equal((await rejected).status(), 401);
    await page.getByRole("link", { name: "다시 로그인", exact: true }).waitFor();
    assert.equal(await draftInput.inputValue(), draftId);
    assert.ok(await saveButton.isDisabled());
    const [unchanged] = await sql`select "youtubeId" from "Song" where id = ${song.id}`;
    assert.equal(unchanged.youtubeId, "lmnopqrstuv");
    await page.screenshot({
      path: path.join(artifacts, "console-reauthentication-required.png"),
      fullPage: true,
      animations: "disabled",
    });

    await changeConsoleAccess(sql, "ADMIN");
    assert.equal(
      (await context.request.get(`${origin}/api/admin/songs`)).status(),
      401,
      "restored ADMIN must not restore the old JWT",
    );
    await context.clearCookies();
    const popup = context.waitForEvent("page");
    await page.getByRole("link", { name: "다시 로그인", exact: true }).click();
    const loginPage = await popup;
    await loginPage.waitForURL(`${origin}/admin-login`);
    await loginConsole(context, origin, sql);
    await loginPage.goto(`${origin}/admin/albums`);
    await loginPage.waitForURL(`${origin}/admin/albums`);
    await loginPage.close();
    await page.getByRole("button", { name: "로그인 상태 확인", exact: true }).click();
    await saveButton.waitFor();
    await page.waitForFunction(
      () =>
        !Array.from(document.querySelectorAll("button"))
          .find((button) => button.textContent === "저장 (Ctrl+S)")
          ?.closest("fieldset")?.disabled,
    );
    assert.equal(await draftInput.inputValue(), draftId);
    const recovered = page.waitForResponse(
      (r) =>
        r.url().endsWith(`/api/admin/songs/${song.id}/lyrics`) && r.request().method() === "PATCH",
    );
    await saveButton.click();
    assert.ok((await recovered).ok());
    const [persisted] = await sql`select "youtubeId" from "Song" where id = ${song.id}`;
    assert.equal(persisted.youtubeId, draftId);
    await page.screenshot({
      path: path.join(artifacts, "console-reauthenticated-editor.png"),
      fullPage: true,
      animations: "disabled",
    });
    console.log(
      "console: 401 blocks persistence, preserves the draft, refreshes ability and resumes after separate-tab login",
    );
  }

  // 공개 Web reader도 같은 commit된 가사 DTO를 읽는지 확인한다.
  const publicSong = await fetch(`${origins.web}/api/songs/p04-${label}-song`);
  assert.ok(publicSong.ok, `public song: HTTP ${publicSong.status}`);
  const detail = await publicSong.json();
  assert.equal(detail.lyrics[0].startTime, 8.5);
  assert.equal(detail.lyrics[0].segments[0].text, "이관 검증 가사");

  await page.goto(`${origin}/admin/songs`);
  await page
    .getByRole("row")
    .filter({ hasText: `${songTitle} edited` })
    .getByTitle("삭제", { exact: true })
    .click();
  const deletedSong = page.waitForResponse(
    (r) => r.url().endsWith(`/api/admin/songs/${song.id}`) && r.request().method() === "DELETE",
  );
  await page
    .getByRole("dialog", { name: "곡 삭제", exact: true })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  assert.ok((await deletedSong).ok());
  await page.getByRole("dialog", { name: "곡 삭제", exact: true }).waitFor({ state: "hidden" });
  assert.equal((await fetch(`${origins.web}/api/songs/p04-${label}-song`)).status, 404);
  await page.goto(`${origin}/admin/albums`);
  await page
    .getByRole("row")
    .filter({ hasText: `${albumName} edited` })
    .getByTitle("삭제", { exact: true })
    .click();
  const deletedAlbum = page.waitForResponse(
    (r) => r.url().endsWith(`/api/admin/albums/${album.id}`) && r.request().method() === "DELETE",
  );
  await page
    .getByRole("dialog", { name: "앨범 삭제", exact: true })
    .getByRole("button", { name: "삭제", exact: true })
    .click();
  assert.ok((await deletedAlbum).ok());
  await page.getByRole("dialog", { name: "앨범 삭제", exact: true }).waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  console.log(
    `${label}: login, album/song create/update, LRC, capture, offset, Undo/Redo, save/reload, public read and deletes passed`,
  );
  return { context, page, cookies, album, song };
}

let origins;
try {
  for (const [role, status, email] of [
    ["ADMIN", "ACTIVE", "admin"],
    ["USER", "ACTIVE", "user"],
    ["ADMIN", "SUSPENDED", "disabled"],
    ["ADMIN", "ACTIVE", "unregistered"],
  ]) {
    const [account] =
      await sql`insert into account (role, status) values (${role}, ${status}) returning id`;
    await sql`insert into profile (account_id, nickname) values (${account.id}, ${`p04-${email}`})`;
    await sql`insert into password_credential (account_id, email, password_hash, email_verified_at, password_changed_at) values (${account.id}, ${`${email}@p04.example.test`}, ${passwordHash}, now(), now())`;
  }
  await enrollConsoleFixture();
  origins = { web: await start("web", 3200), console: await start("console", 3201) };
  browser = await chromium.launch();
  const web = await journey(origins.web, "web");
  const consoleApp = await journey(origins.console, "console");
  await assertConsoleSessionBoundary(browser, origins.console, sql);
  for (const [from, to, target] of [
    [web, origins.console, "oioi-console.session-token"],
    [consoleApp, origins.web, "authjs.session-token"],
  ]) {
    const context = await browser.newContext();
    const session = from.cookies.find((cookie) => cookie.name.includes("session-token"));
    await context.addCookies([{ ...session, name: target, domain: "127.0.0.1" }]);
    assert.equal(
      (await context.request.get(`${to}/api/admin/songs`)).status(),
      401,
      "another app's session must fail even after cookie renaming",
    );
    await context.close();
  }
  for (const email of ["user", "disabled", "unregistered"]) {
    const context = await browser.newContext();
    await loginConsole(context, origins.console, sql, `${email}@p04.example.test`, false);
    assert.equal((await context.request.get(`${origins.console}/api/admin/songs`)).status(), 401);
    await context.close();
  }
  await changeConsoleAccess(sql, "USER");
  assert.equal(
    (await consoleApp.context.request.get(`${origins.console}/api/admin/songs`)).status(),
    401,
    "role demotion invalidates Console identity on the next request",
  );
  console.log(
    "Private admin migration smoke passed: both apps, isolated secrets/cookies, non-admin/inactive rejection and role revocation",
  );
  assertConsoleLogsSafe(artifacts);
} catch (error) {
  if (browser?.isConnected()) {
    for (const [contextIndex, context] of browser.contexts().entries()) {
      for (const [pageIndex, page] of context.pages().entries()) {
        try {
          await page.screenshot({
            path: path.join(artifacts, `failure-${contextIndex}-${pageIndex}.png`),
            fullPage: true,
          });
        } catch {
          /* 실패한 페이지의 캡처 오류는 원래 실패를 가리지 않는다. */
        }
      }
    }
  }
  throw error;
} finally {
  await browser?.close();
  for (const child of processes) {
    if (child.exitCode !== null) continue;
    const exited = once(child, "exit");
    child.kill("SIGTERM");
    const timeout = setTimeout(() => child.kill("SIGKILL"), 5000);
    await exited;
    clearTimeout(timeout);
  }
  await sql.end();
  console.log(`Private admin smoke artifacts: ${artifacts}`);
}
