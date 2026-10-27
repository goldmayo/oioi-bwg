import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type { Database } from "@oioi-bwg/server/db";
import * as schema from "@oioi-bwg/server/db/schema";
import { createEntityId } from "@oioi-bwg/server/db/entity-id";
import { bootstrapConsoleAdminCredential } from "@oioi-bwg/server/services/console-admin-bootstrap-service";
import {
  setupConsoleMfa,
  confirmConsoleMfa,
  authenticateConsoleMfa,
} from "@oioi-bwg/server/services/console-mfa-service";
import { generateSync } from "otplib";

import { createUuidCutoverMap } from "../../src/operators/uuid-cutover-map";

let database: Database;
vi.mock("@oioi-bwg/server/db", () => ({ getDatabase: () => database }));
const run = promisify(execFile);
const verificationUrl = new URL(process.env.M7_TEST_POSTGRES_VERIFICATION_URL ?? "http://invalid");
const migratorUrl = new URL(process.env.M9_TEST_POSTGRES_MIGRATOR_URL ?? "http://invalid");
const appUrl = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  verificationUrl.hostname !== "127.0.0.1" ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(verificationUrl.pathname)
)
  throw new Error("Isolated local integration database required");
verificationUrl.pathname = "/postgres";
const admin = postgres(verificationUrl.toString(), { max: 1 });
let owner: ReturnType<typeof postgres>;
let app: ReturnType<typeof postgres>;
let name: string;
let directory: string;

beforeEach(async () => {
  name = `oioi_m7_test_uuid_${randomUUID().replaceAll("-", "").slice(0, 12)}`;
  directory = mkdtempSync(path.join(tmpdir(), "uuid-cutover-"));
  await admin`create database ${admin(name)} owner ${admin(decodeURIComponent(migratorUrl.username))}`;
  migratorUrl.pathname = appUrl.pathname = `/${name}`;
  owner = postgres(migratorUrl.toString(), { max: 2, connection: { statement_timeout: 15_000 } });
  await run("pnpm", ["db:migrate", "--legacy-schema"], {
    env: { PATH: process.env.PATH, DATABASE_URL: migratorUrl.toString() },
  });
  const dump = process.env.OIOI_UUID_REHEARSAL_DUMP;
  if (dump) {
    await run("pnpm", ["db:restore-local", dump, "--database", name], {
      env: { PATH: process.env.PATH },
    });
  } else {
    await owner`insert into "Album" (name, slug, "imgUrl", color, "isVisible") values ('Album', 'album', 'https://example.invalid/original.webp', '#123456', true), ('Hidden empty', 'hidden-empty', 'https://example.invalid/empty.webp', '#654321', false)`;
    await owner`insert into "Song" (id, "albumId", title, "youtubeId", lyrics, "order", slug) values (9007199254740993, 1, '원본 곡', 'original-video', '[{"startTime":1,"segments":[{"text":"원본 가사"}]}]'::jsonb, 3, 'original-song')`;
  }
  await owner`insert into account (role, status) values ('ADMIN', 'ACTIVE'), ('USER', 'ACTIVE')`;
  await owner`insert into profile (account_id, nickname) values (1, '관리자'), (2, '일반 사용자')`;
  await owner`insert into password_credential (account_id, email, password_hash, email_verified_at, password_changed_at) values (1, 'old-admin@example.invalid', 'old-admin-hash', now(), now()), (2, 'user@example.invalid', 'user-hash-preserved', now(), now())`;
  await owner`insert into admin_mfa (account_id, encrypted_secret, enabled_at, last_used_step, version) values (1, 'old-aad-bound-cipher', now(), 123, 8)`;
  await owner`grant select, insert, update, delete on all tables in schema public to ${owner(decodeURIComponent(appUrl.username))}`;
  app = postgres(appUrl.toString(), { max: 2 });
  database = drizzle(app, { schema });
});
afterEach(async () => {
  await app?.end();
  await owner?.end();
  if (name) await admin`drop database ${admin(name)}`;
  rmSync(directory, { recursive: true, force: true });
});
afterAll(() => admin.end());

async function source() {
  return {
    albums: await owner`select id::text as id from "Album" order by id`,
    songs: await owner`select id::text as id, "albumId"::text as "albumId" from "Song" order by id`,
    accounts:
      await owner`select a.id::text as id, a.role, a.status, m.version as "mfaVersion" from account a left join admin_mfa m on m.account_id=a.id order by a.id`,
  };
}
async function apply(mapping?: unknown) {
  const file = path.join(directory, "mapping.json");
  if (mapping) writeFileSync(file, JSON.stringify(mapping), { mode: 0o600 });
  return run("pnpm", ["db:migrate", ...(mapping ? ["--uuid-map", file] : [])], {
    env: { PATH: process.env.PATH, DATABASE_URL: migratorUrl.toString() },
  });
}
async function expectLegacyIntact() {
  expect(
    (await owner`select count(*)::int as count from drizzle.__drizzle_migrations`)[0]!.count,
  ).toBe(6);
  expect(
    (
      await owner`select data_type from information_schema.columns where table_schema='public' and table_name='Album' and column_name='id'`
    )[0]!.data_type,
  ).toBe("integer");
  expect(await owner`select password_hash from password_credential where account_id=1`).toEqual([
    { password_hash: "old-admin-hash" },
  ]);
  expect(await owner`select encrypted_secret, version from admin_mfa where account_id=1`).toEqual([
    { encrypted_secret: "old-aad-bound-cipher", version: 8 },
  ]);
}

describe.sequential("UUID data-preserving cutover", () => {
  test("the real TTY bootstrap accepts hidden input without echoing passwords or email", async () => {
    const originalAppUrl = process.env.DATABASE_URL!;
    const cliDatabase = postgres(originalAppUrl, { max: 1 });
    const id = createEntityId();
    const config = path.join(directory, "operator.json"),
      reason = path.join(directory, "reason.txt");
    try {
      await cliDatabase`insert into account (id, role, status) values (${id}, 'ADMIN', 'ACTIVE')`;
      await cliDatabase`insert into admin_mfa (account_id, version) values (${id}, 1)`;
      const [instance] =
        await cliDatabase`select extract(epoch from pg_postmaster_start_time())::text as started`;
      writeFileSync(
        config,
        JSON.stringify({
          scope: "local-compose",
          operatorUid: process.getuid!(),
          databaseUrl: originalAppUrl,
          serverStartedAt: instance!.started,
        }),
        { mode: 0o600 },
      );
      writeFileSync(reason, "격리된 TTY 재등록 검증", { mode: 0o600 });
      const email = `tty-${id}@example.invalid`,
        password = "Hidden-TTY-password1!";
      const program = `
import json, os, pty, select, signal, time
data=json.load(__import__('sys').stdin)
pid, fd=pty.fork()
if pid == 0: os.execv(data['command'][0], data['command'])
output=b''
reaped=False
finished=False
deadline=time.monotonic()+15
try:
    for prompt, answer in zip([b'Console email (hidden): ', b'New Console password (hidden): ', b'Confirm password (hidden): '], data['answers']):
        while prompt not in output:
            if time.monotonic()>deadline: raise TimeoutError('TTY prompt timeout')
            if select.select([fd], [], [], 0.1)[0]: output+=os.read(fd, 65536)
        os.write(fd, answer.encode()+b'\\n')
    while time.monotonic()<deadline:
        if select.select([fd], [], [], 0.1)[0]:
            try: chunk=os.read(fd, 65536)
            except OSError: finished=True; break
            if not chunk: finished=True; break
            output+=chunk
    if not finished: raise TimeoutError('TTY process timeout')
    _, status=os.waitpid(pid, 0)
    reaped=True
    print(json.dumps({'exit': os.waitstatus_to_exitcode(status), 'output': output.decode()}))
finally:
    if not reaped:
        try: os.kill(pid, signal.SIGKILL)
        except ProcessLookupError: pass
        try: os.waitpid(pid, 0)
        except ChildProcessError: pass
    os.close(fd)
`;
      const result = await new Promise<{ exit: number; output: string }>((resolve, reject) => {
        const child = execFile(
          "python3",
          ["-I", "-c", program],
          { timeout: 20_000, env: { PATH: process.env.PATH } },
          (error, stdout) => (error ? reject(error) : resolve(JSON.parse(stdout))),
        );
        child.stdin!.end(
          JSON.stringify({
            command: [
              process.execPath,
              "--conditions=react-server",
              "--import",
              "tsx",
              path.resolve("scripts/console-admin-bootstrap.ts"),
              "--config",
              config,
              "--account-id",
              id,
              "--expected-version",
              "1",
              "--reason-file",
              reason,
              "--apply",
            ],
            answers: [email, password, password],
          }),
        );
      });
      expect(result.exit, result.output).toBe(0);
      expect(result.output).not.toContain(email);
      expect(result.output).not.toContain(password);
      expect(result.output).toContain('"credentialCreated":true');
      const [credential] =
        await cliDatabase`select password_hash from password_credential where account_id=${id}`;
      expect(credential!.password_hash).toMatch(/^\$argon2id\$/);
    } finally {
      await cliDatabase`delete from password_credential where account_id=${id}`;
      await cliDatabase`delete from admin_mfa where account_id=${id}`;
      await cliDatabase`delete from account where id=${id}`;
      await cliDatabase.end();
    }
  });
  test("populated DB rejects missing/stale maps and unapproved MFA reset before any change", async () => {
    await expect(apply()).rejects.toMatchObject({
      stderr: expect.stringContaining("UUID_CUTOVER_MAP_COVERAGE_REJECTED"),
    });
    await expectLegacyIntact();
    const map = createUuidCutoverMap(await source(), createEntityId);
    await expect(apply(map)).rejects.toMatchObject({
      stderr: expect.stringContaining("UUID_CUTOVER_ADMIN_RESET_REQUIRED"),
    });
    await expectLegacyIntact();
    const approved = createUuidCutoverMap(await source(), createEntityId, ["1"]);
    const stale = { ...approved, songs: approved.songs.slice(1) };
    await expect(apply(stale)).rejects.toThrow();
    await expectLegacyIntact();
    await owner`update account set status='SUSPENDED' where id=1`;
    await expect(apply(approved)).rejects.toMatchObject({
      stderr: expect.stringContaining("UUID_CUTOVER_ACCOUNT_CHANGED"),
    });
    await expectLegacyIntact();
  });

  test("DDL failure rolls back credentials, MFA, FK changes, and metadata; same map retries", async () => {
    const map = createUuidCutoverMap(await source(), createEntityId, ["1"]);
    await owner`alter table "Album" add constraint rehearsal_legacy_id_check check (id > 0)`;
    await expect(apply(map)).rejects.toThrow();
    await expectLegacyIntact();
    await owner`alter table "Album" drop constraint rehearsal_legacy_id_check`;
    await apply(map);
    expect(await owner`select id from album order by id`).toHaveLength(map.albums.length);
    await apply(map);
    expect(
      (await owner`select count(*)::int as count from drizzle.__drizzle_migrations`)[0]!.count,
    ).toBe(11);
  });

  test("preserves complete content/relations and ordinary credentials, resets only selected admin, then re-enrolls", async () => {
    const original = await source();
    const map = createUuidCutoverMap(original, createEntityId, ["1"]);
    const before =
      await owner`select id::text as id, to_jsonb(a)-'id' as payload from "Album" a order by id`;
    const started = performance.now();
    await apply(map);
    console.info(
      JSON.stringify({
        rehearsal: process.env.OIOI_UUID_REHEARSAL_DUMP
          ? "approved-local-dump"
          : "isolated-fixture",
        albums: map.albums.length,
        songs: map.songs.length,
        accounts: map.accounts.length,
        migrateCommandWallMs: Math.round(performance.now() - started),
      }),
    );
    const after = await owner`select id, name, slug, image_url, color, is_visible from album`;
    expect(after).toHaveLength(before.length);
    for (const row of before)
      expect(
        after.find((a) => a.id === map.albums.find((a) => a.oldId === row.id)!.id),
      ).toMatchObject({
        name: row.payload.name,
        slug: row.payload.slug,
        image_url: row.payload.imgUrl,
        color: row.payload.color,
        is_visible: row.payload.isVisible,
      });
    for (const row of map.songs)
      expect(await owner`select album_id from song where id=${row.id}`).toEqual([
        { album_id: row.albumId },
      ]);
    const adminId = map.accounts.find((a) => a.oldId === "1")!.id;
    const userId = map.accounts.find((a) => a.oldId === "2")!.id;
    expect(
      await owner`select password_hash from password_credential where account_id=${userId}`,
    ).toEqual([{ password_hash: "user-hash-preserved" }]);
    expect(await owner`select nickname from profile where account_id=${adminId}`).toEqual([
      { nickname: "관리자" },
    ]);
    expect(
      await owner`select account_id from password_credential where account_id=${adminId}`,
    ).toHaveLength(0);
    expect(
      await owner`select encrypted_secret, enabled_at, last_used_step, version from admin_mfa where account_id=${adminId}`,
    ).toEqual([{ encrypted_secret: null, enabled_at: null, last_used_step: null, version: 9 }]);
    const email = "new-admin@example.invalid",
      password = "New-admin-password1!",
      key = Buffer.alloc(32, 7);
    await expect(
      bootstrapConsoleAdminCredential(userId, null, email, password),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      bootstrapConsoleAdminCredential(adminId, 8, email, password),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const registrations = await Promise.allSettled([
      bootstrapConsoleAdminCredential(adminId, 9, email, password),
      bootstrapConsoleAdminCredential(adminId, 9, email, password),
    ]);
    expect(registrations.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    await expect(
      bootstrapConsoleAdminCredential(adminId, 9, email, password),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    const pending = await setupConsoleMfa(email, password, key);
    const epoch = Math.floor(Date.now() / 1000);
    const token = generateSync({ secret: pending.secret, epoch });
    await confirmConsoleMfa(email, password, token, pending.version, key);
    const nextToken = generateSync({ secret: pending.secret, epoch: epoch + 30 });
    expect(await authenticateConsoleMfa(email, password, nextToken, key)).toMatchObject({
      id: adminId,
      mfaVerified: true,
      mfaVersion: 9,
    });
    expect(
      await owner`select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in ('Album_id_seq','Song_id_seq','account_id_seq')`,
    ).toHaveLength(0);
  });

  test("bounds lock waiting and leaves the original schema unchanged", async () => {
    const map = createUuidCutoverMap(await source(), createEntityId, ["1"]);
    await owner.begin(async (sql) => {
      await sql.unsafe('lock table "Album" in access exclusive mode');
      await expect(apply(map)).rejects.toMatchObject({
        stderr: expect.stringContaining("lock timeout"),
      });
    });
    await expectLegacyIntact();
  });

  test.skipIf(!process.env.OIOI_UUID_REHEARSAL_DUMP)(
    "restores a full pre-cutover native backup including credential/MFA and migration history",
    async () => {
      const map = createUuidCutoverMap(await source(), createEntityId, ["1"]);
      const backup = path.join(directory, "before.dump");
      const recoveredName = `${name}_recovered`;
      const remoteBackup = `/tmp/${recoveredName}.dump`;
      const compose = ["compose", "-f", "compose.dev.yml"];
      const { stdout } = await run(
        "docker",
        [...compose, "exec", "-T", "postgres", "pg_dump", "-Fc", "-U", "oioibawige", "-d", name],
        { encoding: "buffer", maxBuffer: 16 * 1024 * 1024 },
      );
      writeFileSync(backup, stdout, { mode: 0o600 });
      await apply(map);
      let recovered: ReturnType<typeof postgres> | undefined;
      let created = false;
      try {
        await admin`create database ${admin(recoveredName)} owner ${admin(decodeURIComponent(migratorUrl.username))}`;
        created = true;
        await run("docker", [...compose, "cp", backup, `postgres:${remoteBackup}`]);
        await run("docker", [
          ...compose,
          "exec",
          "-T",
          "postgres",
          "pg_restore",
          "--exit-on-error",
          "-U",
          "oioibawige",
          "-d",
          recoveredName,
          remoteBackup,
        ]);
        const recoveredUrl = new URL(migratorUrl);
        recoveredUrl.pathname = `/${recoveredName}`;
        recovered = postgres(recoveredUrl.toString(), { max: 1 });
        expect((await recovered`select count(*)::int as count from "Album"`)[0]!.count).toBe(
          map.albums.length,
        );
        expect((await recovered`select count(*)::int as count from "Song"`)[0]!.count).toBe(
          map.songs.length,
        );
        expect(
          (await recovered`select count(*)::int as count from drizzle.__drizzle_migrations`)[0]!
            .count,
        ).toBe(6);
        expect(
          await recovered`select password_hash from password_credential where account_id=1`,
        ).toEqual([{ password_hash: "old-admin-hash" }]);
        expect(
          await recovered`select encrypted_secret, version from admin_mfa where account_id=1`,
        ).toEqual([{ encrypted_secret: "old-aad-bound-cipher", version: 8 }]);
        expect(
          (
            await recovered`select has_table_privilege(${decodeURIComponent(appUrl.username)}, 'public."Album"', 'select') as allowed`
          )[0]!.allowed,
        ).toBe(true);
        console.info(
          JSON.stringify({
            nativeBackupRestore: "passed",
            albums: map.albums.length,
            songs: map.songs.length,
            migrationHistory: 6,
          }),
        );
      } finally {
        await recovered?.end();
        if (created) await admin`drop database ${admin(recoveredName)}`;
        await run("docker", [...compose, "exec", "-T", "postgres", "rm", "-f", remoteBackup]);
      }
    },
  );
});
