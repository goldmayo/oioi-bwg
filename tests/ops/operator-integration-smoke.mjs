import assert from "node:assert/strict";
import { spawn, execFile } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { promisify } from "node:util";
import { chromium } from "playwright";
import postgres from "postgres";
import { enrollConsoleFixture, nextConsoleOtp, fixtureKey } from "./console-mfa-smoke.mjs";

// 기존 runner가 만든 일회성 DB에서만 실행하며 운영/복원 DB는 거절한다.
for (const key of ["DATABASE_URL", "M7_TEST_POSTGRES_VERIFICATION_URL"]) {
  const url = new URL(process.env[key] ?? "");
  assert.equal(url.hostname, "127.0.0.1");
  assert.match(url.pathname, /^\/oioi_m7_test_[a-z0-9_]+$/);
}
const binary = process.env.OIOI_OPERATOR_BINARY;
assert.ok(
  binary && path.isAbsolute(binary),
  "OIOI_OPERATOR_BINARY must be an absolute executable path",
);
fs.accessSync(binary, fs.constants.X_OK);
const directory = fs.mkdtempSync(path.join(os.tmpdir(), "oioi-operator-integration-"));
const sql = postgres(process.env.M7_TEST_POSTGRES_VERIFICATION_URL, { max: 1 });
const runFile = promisify(execFile);
const { v7: uuidv7 } = await import(
  createRequire(new URL("../../packages/server/package.json", import.meta.url)).resolve("uuid")
);
const origin = "http://127.0.0.1:3301";
const video = "9yfrVqCcrS0";
const config = path.join(directory, "operator.toml");
const output = path.join(directory, "waveforms");
// 개인 env/credential·앱 DB 설정을 Rust와 worker에 상속하지 않는다.
const cliEnv = {
  PATH: process.env.PATH,
  HOME: directory,
  LANG: "C.UTF-8",
  NO_PROXY: "127.0.0.1,localhost",
  XDG_CONFIG_HOME: path.join(directory, "config"),
  XDG_DATA_HOME: path.join(directory, "data"),
  XDG_STATE_HOME: path.join(directory, "state"),
};
const args = ["--config", config, "--json"];
const secrets = [fixtureKey, "P04-fixture-pass1!", "p04-console-private-browser-fixture-secret"];
let server, browser, login;
async function cli(command) {
  const result = await runFile(binary, [...args, ...command], {
    env: cliEnv,
    timeout: 180_000,
    maxBuffer: 8 * 1024 * 1024,
  });
  for (const secret of secrets)
    assert.ok(!(result.stdout + result.stderr).includes(secret), "CLI output leaked a secret");
  return JSON.parse(result.stdout);
}
async function save(page, name, endpoint) {
  const response = page.waitForResponse(
    (r) => r.url().endsWith(endpoint) && r.request().method() === "POST",
  );
  await page
    .getByRole("dialog", { name, exact: true })
    .getByRole("button", { name: "추가", exact: true })
    .click();
  const value = await response;
  assert.ok(value.ok(), `Console create failed: HTTP ${value.status()}`);
  await page.getByRole("dialog", { name, exact: true }).waitFor({ state: "hidden" });
  return value.json();
}
try {
  const accountId = uuidv7();
  await sql`insert into account (id,role,status) values (${accountId},'ADMIN','ACTIVE')`;
  await sql`insert into profile (account_id,nickname) values (${accountId},'operator-integration')`;
  await sql`insert into password_credential (account_id,email,password_hash,email_verified_at,password_changed_at) values (${accountId},'admin@p04.example.test','$argon2id$v=19$m=19456,p=1,t=2$cDA0LWJyb3dzZXItZml4dHVyZS1zYWx0$B2TTF8IxGl6mwC9jStRh3/z88pnDsCMwg9Ft8nslGpY',now(),now())`;
  await enrollConsoleFixture();
  const descriptor = fs.openSync(path.join(directory, "console.log"), "w", 0o600);
  server = spawn(process.execPath, ["apps/console/.next/standalone/apps/console/server.js"], {
    env: {
      PATH: process.env.PATH,
      NODE_ENV: "production",
      HOSTNAME: "127.0.0.1",
      PORT: "3301",
      DATABASE_URL: process.env.DATABASE_URL,
      NEXT_PUBLIC_APP_ENV: "local",
      CONSOLE_ORIGIN: origin,
      CONSOLE_AUTH_SECRET: "p04-console-private-browser-fixture-secret",
      CONSOLE_MFA_ENCRYPTION_KEY: fixtureKey,
      CONSOLE_OPERATOR_ENABLED: "true",
      CONSOLE_MFA_ENROLLMENT_ENABLED: "false",
    },
    stdio: ["ignore", descriptor, descriptor],
  });
  fs.closeSync(descriptor);
  for (let attempt = 0; ; attempt++) {
    assert.equal(server.exitCode, null, "Console exited before readiness");
    assert.ok(attempt < 100, "Console readiness timeout");
    try {
      if ((await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(500) })).ok) break;
    } catch {
      /* readiness */
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  await cli(["config", "init", "--console", origin]);
  login = spawn(binary, [...args, "auth", "login", "--no-browser"], {
    env: cliEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  let loginOut = "",
    loginErr = "";
  login.stdout.on("data", (data) => {
    loginOut += data;
  });
  login.stderr.on("data", (data) => {
    loginErr += data;
  });
  const loginFinished = once(login, "exit");
  const deadline = Date.now() + 15_000;
  while (!/연결 코드: ([A-Z2-9]{4}-[A-Z2-9]{4})/.test(loginErr)) {
    assert.equal(login.exitCode, null, "CLI login exited before code");
    assert.ok(Date.now() < deadline, "CLI code timeout");
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  const code = loginErr.match(/연결 코드: ([A-Z2-9]{4}-[A-Z2-9]{4})/)[1];
  secrets.push(code);
  browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    acceptDownloads: true,
  });
  await context.route(/^https:\/\//, (route) => route.abort());
  const page = await context.newPage();
  await page.goto(`${origin}/operator-connect`);
  await page.getByLabel("Email", { exact: true }).fill("admin@p04.example.test");
  await page.getByLabel("Password", { exact: true }).fill("P04-fixture-pass1!");
  await page.getByRole("button", { name: "다음", exact: true }).click();
  const otp = await nextConsoleOtp(sql);
  secrets.push(otp);
  await page.getByLabel("인증 코드", { exact: true }).fill(otp);
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await page.waitForURL(`${origin}/operator-connect`);
  await page.getByLabel("연결 코드", { exact: true }).fill(code);
  await page.getByRole("button", { name: "연결 승인", exact: true }).click();
  await page.getByRole("heading", { name: "연결을 승인했습니다.", exact: true }).waitFor();
  const [loginExit] = await loginFinished;
  assert.equal(loginExit, 0, "Rust token exchange failed");
  assert.equal(JSON.parse(loginOut).connected, true);
  const tokenFile = path.join(directory, "state/oioi-operator/auth/local.json");
  const credential = JSON.parse(fs.readFileSync(tokenFile, "utf8"));
  assert.equal(fs.statSync(tokenFile).mode & 0o777, 0o600);
  assert.equal(credential.origin, origin);
  secrets.push(credential.accessToken);
  for (const secret of secrets)
    assert.ok(!loginOut.includes(secret), "login stdout leaked a secret");
  assert.equal((await cli(["--non-interactive", "auth", "status"])).accountId, accountId);
  assert.equal(new URL(page.url()).search, "");
  const storage = await page.evaluate(() =>
    JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }),
  );
  assert.ok(!storage.includes(code), "approval code persisted in browser storage");
  await page.goto(`${origin}/admin/albums`);
  await page.getByRole("button", { name: "앨범 추가", exact: true }).click();
  await page.getByLabel("앨범 이름", { exact: true }).fill("운영 도구 격리 검증");
  await page.getByLabel("Slug", { exact: true }).fill("operator-integration-album");
  await page
    .getByLabel("앨범 이미지", { exact: true })
    .fill("https://example.invalid/operator.webp");
  await save(page, "앨범 추가", "/api/admin/albums");
  await page.goto(`${origin}/admin/songs`);
  await page.getByRole("button", { name: "곡 추가", exact: true }).click();
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "운영 도구 격리 검증", exact: true }).click();
  await page.getByLabel("곡 제목", { exact: true }).fill("내 이름 맑음");
  await page.getByLabel("Slug", { exact: true }).fill("operator-integration-song");
  await page.getByLabel("YouTube ID", { exact: true }).fill(video);
  await page.locator('input[type="file"]').setInputFiles({
    name: "operator-fixture.lrc",
    mimeType: "text/plain",
    buffer: Buffer.from("[00:01.00]격리 검증 가사\n[00:02.00]원본 보존 확인"),
  });
  const song = await save(page, "곡 추가", "/api/admin/songs");
  const before =
    await sql`select title,youtube_id,lyrics,is_visible,has_official_cheer from song where id=${song.id}`;
  const guidesBefore = await sql`select * from cheer_guide where song_id=${song.id} order by id`;
  await page.getByRole("checkbox", { name: "내 이름 맑음 선택", exact: true }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "파형 작업 파일 다운로드 (1곡)", exact: true }).click();
  const download = await downloadEvent;
  assert.match(
    download.suggestedFilename(),
    /^oioi-operator-waveform_\d{8}_\d{6}_\d{3}_KST\.json$/,
  );
  const input = path.join(directory, download.suggestedFilename());
  await download.saveAs(input);
  assert.deepEqual(JSON.parse(fs.readFileSync(input, "utf8")), { version: 1, videoIds: [video] });
  await page.screenshot({
    path: path.join(directory, "selected-song.png"),
    animations: "disabled",
  });
  const first = await cli(["--non-interactive", "run", "--input", input, "--output-dir", output]);
  assert.deepEqual(first.counts, { UPLOADED: 1 });
  const artifact = JSON.parse(fs.readFileSync(path.join(output, `${video}.waveform.json`), "utf8"));
  const [stored] = await sql`select data from waveform where song_id=${song.id}`;
  assert.deepEqual(stored.data, artifact, "actual generated JSON differs from server JSONB");
  assert.equal(artifact.source.id, video);
  assert.ok(artifact.durationMs > 0 && artifact.peaks.length > 0);
  const [job] = await sql`select id,status,video_id from waveform_job where song_id=${song.id}`;
  assert.equal(job.status, "SUCCEEDED");
  assert.equal(first.state.items[0].jobId, job.id);
  assert.deepEqual(
    await sql`select title,youtube_id,lyrics,is_visible,has_official_cheer from song where id=${song.id}`,
    before,
  );
  assert.deepEqual(
    await sql`select * from cheer_guide where song_id=${song.id} order by id`,
    guidesBefore,
  );
  assert.deepEqual(
    (await cli(["--non-interactive", "run", "--input", input, "--output-dir", output])).counts,
    { SKIPPED_EXISTING: 1 },
  );
  assert.deepEqual((await cli(["--non-interactive", "runs", "resume", first.runId])).counts, {
    UNCHANGED: 1,
  });
  const [count] =
    await sql`select count(*)::int as count from waveform_job where song_id=${song.id}`;
  assert.equal(count.count, 1, "repeat/resume created a duplicate Job");
  await cli(["auth", "logout"]);
  const [connection] =
    await sql`select count(*)::int as count from operator_session where account_id=${accountId} and revoked_at is null and token_hash is not null`;
  assert.equal(connection.count, 0);
  // 코드가 보이는 승인 전 캡처나 token은 artifact로 저장하지 않는다.
  for (const file of [
    path.join(directory, "console.log"),
    ...fs.readdirSync(first.runDir).map((name) => path.join(first.runDir, name)),
  ]) {
    const raw = fs.readFileSync(file, "utf8");
    for (const secret of secrets)
      assert.ok(!raw.includes(secret), "history/server log leaked a secret");
  }
  console.log(
    JSON.stringify({
      browserAuthMfa: true,
      deviceApprovalExchange: true,
      selectedManifest: true,
      actualVideoId: video,
      actualDurationMs: artifact.durationMs,
      buckets: artifact.peaks.length,
      serverJsonEqual: true,
      existingSongContentPreserved: true,
      repeatAndResumeSingleJob: true,
      revoked: true,
      artifactDirectory: directory,
    }),
  );
} finally {
  await browser?.close();
  for (const child of [login, server]) {
    if (child && child.exitCode === null) {
      const stopped = once(child, "exit");
      child.kill("SIGTERM");
      await stopped;
    }
  }
  await sql.end();
}
