import { execFile } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, expect, test } from "vitest";

import { getDatabase } from "@oioi-bwg/server/db";
import { account, adminMfa } from "@oioi-bwg/server/db/schema";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (url.hostname !== "127.0.0.1" || !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname))
  throw new Error("Refusing non-isolated operator integration database");
const database = getDatabase();
const directory = mkdtempSync(path.join(tmpdir(), "p05b3-cli-"));
const config = path.join(directory, "operator.json");
const reasonFile = path.join(directory, "reason.txt");
const reason = "변경 사유 원문은 출력하지 않음";
beforeAll(async () => {
  writeFileSync(reasonFile, reason, { mode: 0o600 });
  const [row] =
    await database.$client`select extract(epoch from pg_postmaster_start_time())::text as started`;
  writeFileSync(
    config,
    JSON.stringify({
      scope: "local-compose",
      operatorUid: process.getuid!(),
      databaseUrl: url.toString(),
      serverStartedAt: row!.started,
    }),
    { mode: 0o600 },
  );
});
afterAll(async () => {
  await database.$client.end();
  rmSync(directory, { recursive: true, force: true });
});

async function fixture(version: number | null = 1) {
  const [row] = await database
    .insert(account)
    .values({ role: "ADMIN", status: "ACTIVE" })
    .returning();
  const id = row!.id;
  if (version !== null)
    await database.insert(adminMfa).values({
      accountId: id,
      encryptedSecret: "cipher-never-output",
      enabledAt: "2026-10-10T00:00:00Z",
      lastUsedStep: 123,
      version,
    });
  return id;
}

async function cli(
  id: bigint,
  version: number | "none",
  access?: [string, string, string, string],
  file = config,
) {
  const args = [
    "--silent",
    "console:mfa",
    access ? "account-access" : "mfa-reset",
    "--config",
    file,
    "--account-id",
    id.toString(),
    "--expected-version",
    String(version),
    "--reason-file",
    reasonFile,
    "--apply",
  ];
  if (access)
    args.push(
      "--expected-role",
      access[0],
      "--expected-status",
      access[1],
      "--role",
      access[2],
      "--status",
      access[3],
    );
  const output = await promisify(execFile)("pnpm", args, {
    env: { PATH: process.env.PATH, DATABASE_URL: "postgresql://ignored.invalid/production" },
    timeout: 10_000,
  }).then(
    ({ stdout }) => stdout,
    (error: { stderr: string }) => error.stderr,
  );
  for (const forbidden of [
    reason,
    "cipher-never-output",
    url.password,
    "postgresql://",
    "stack",
    "query",
  ])
    expect(output).not.toContain(forbidden);
  return JSON.parse(output) as { success: boolean; code?: string; version?: number };
}

test("CLI concurrent reset succeeds exactly once and preserves the cleared row/version", async () => {
  const id = await fixture();
  let ready!: () => void;
  let release!: () => void;
  const locked = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const lock = database.transaction(async (tx) => {
    await tx.select().from(account).where(eq(account.id, id)).for("update");
    ready();
    await held;
  });
  await Promise.race([locked, lock]);
  const concurrent = Promise.all([cli(id, 1), cli(id, 1)]);
  try {
    let blocked = 0;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const [row] =
        await database.$client`select count(*)::int as blocked from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.datname=current_database() and l.locktype in ('transactionid','tuple') and not l.granted`;
      blocked = row!.blocked;
      if (blocked >= 2) break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(blocked).toBeGreaterThanOrEqual(2);
  } finally {
    release();
    await lock;
  }
  const results = await concurrent;
  expect(results.filter((r) => r.success)).toHaveLength(1);
  expect(results.find((r) => !r.success)).toMatchObject({
    success: false,
    code: "STATE_CHANGED",
    accountId: id.toString(),
    command: "mfa-reset",
  });
  expect(
    await database.query.adminMfa.findFirst({ where: eq(adminMfa.accountId, id) }),
  ).toMatchObject({ encryptedSecret: null, version: 2 });
  const absent = await fixture(null);
  expect(await cli(absent, "none")).toMatchObject({
    success: true,
    previousVersion: null,
    version: 1,
  });
  expect(await cli(absent, "none")).toMatchObject({ success: false, code: "STATE_CHANGED" });
});

test("CLI access revokes on demotion/restoration/suspension/restoration; actual overflow rolls back", async () => {
  const id = await fixture();
  let version = 1;
  for (const access of [
    ["ADMIN", "ACTIVE", "USER", "ACTIVE"],
    ["USER", "ACTIVE", "ADMIN", "ACTIVE"],
    ["ADMIN", "ACTIVE", "ADMIN", "SUSPENDED"],
    ["ADMIN", "SUSPENDED", "ADMIN", "ACTIVE"],
  ] as [string, string, string, string][]) {
    expect(await cli(id, version, access)).toMatchObject({
      success: true,
      previousVersion: version,
      version: ++version,
      previousRole: access[0],
      previousStatus: access[1],
      role: access[2],
      status: access[3],
    });
  }
  expect(
    await database.query.adminMfa.findFirst({ where: eq(adminMfa.accountId, id) }),
  ).toMatchObject({ encryptedSecret: "cipher-never-output", lastUsedStep: 123, version: 5 });
  const atLimit = await fixture(2_147_483_647);
  expect(await cli(atLimit, 2_147_483_647, ["ADMIN", "ACTIVE", "USER", "SUSPENDED"])).toMatchObject(
    {
      success: false,
      code: "OPERATION_FAILED",
    },
  );
  expect(await database.query.account.findFirst({ where: eq(account.id, atLimit) })).toMatchObject({
    role: "ADMIN",
    status: "ACTIVE",
  });
  expect(
    await database.query.adminMfa.findFirst({ where: eq(adminMfa.accountId, atLimit) }),
  ).toMatchObject({ version: 2_147_483_647 });
});

test("CLI rejects a stale DB instance fingerprint before mutation", async () => {
  const id = await fixture();
  const wrong = path.join(directory, "wrong.json");
  writeFileSync(
    wrong,
    JSON.stringify({
      scope: "local-compose",
      operatorUid: process.getuid!(),
      databaseUrl: url.toString(),
      serverStartedAt: "1234567890.000000",
    }),
    { mode: 0o600 },
  );
  expect(await cli(id, 1, undefined, wrong)).toMatchObject({
    success: false,
    code: "DATABASE_TARGET_REJECTED",
  });
  expect(
    await database.query.adminMfa.findFirst({ where: eq(adminMfa.accountId, id) }),
  ).toMatchObject({ encryptedSecret: "cipher-never-output", version: 1 });
});
