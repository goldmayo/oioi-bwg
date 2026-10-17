import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import * as schema from "@oioi-bwg/server/db/schema";
import * as mfa from "@oioi-bwg/server/repositories/admin-mfa-repository";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");
const url = new URL(databaseUrl);
if (
  !new Set(["localhost", "127.0.0.1"]).has(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
) {
  throw new Error("Refusing a non-isolated PostgreSQL integration database");
}
const client = postgres(databaseUrl, { max: 4, connection: { statement_timeout: 10_000 } });
const database = drizzle(client, { schema });
afterAll(() => client.end());

async function createAccount() {
  const [row] = await database
    .insert(schema.account)
    .values({ role: "ADMIN", status: "ACTIVE" })
    .returning();
  return row!.id;
}

test("AUTH-009 rejects invalid MFA states and accepts reset, pending, and enabled states", async () => {
  const id = await createAccount();
  const invalid = [
    [null, "2026-10-10T00:00:00Z", 1, 1, "admin_mfa_state_check"],
    ["cipher", "2026-10-10T00:00:00Z", null, 1, "admin_mfa_state_check"],
    ["cipher", null, 1, 1, "admin_mfa_state_check"],
    [null, null, 1, 1, "admin_mfa_state_check"],
    ["", null, null, 1, "admin_mfa_secret_check"],
    ["cipher", "2026-10-10T00:00:00Z", -1, 1, "admin_mfa_step_check"],
    [null, null, null, 0, "admin_mfa_version_check"],
    [null, null, null, -1, "admin_mfa_version_check"],
  ] as const;
  for (const [secret, enabledAt, step, version, constraint] of invalid) {
    await expect(
      client`insert into admin_mfa values (${id}, ${secret}, ${enabledAt}, ${step}, ${version})`,
    ).rejects.toMatchObject({ code: "23514", constraint_name: constraint });
  }
  await expect(
    client`insert into admin_mfa (account_id, version) values (${id}, null)`,
  ).rejects.toMatchObject({ code: "23502" });
  expect(await mfa.incrementAdminMfaVersion(database, id)).toEqual([{ version: 1 }]);
  expect(await mfa.ensurePendingAdminMfa(database, id, "cipher")).toMatchObject({
    version: 1,
    enabledAt: null,
    lastUsedStep: null,
  });
  await database
    .update(schema.adminMfa)
    .set({ enabledAt: "2026-10-10T00:00:00Z", lastUsedStep: 0 })
    .where(eq(schema.adminMfa.accountId, id));
  expect(await mfa.ensurePendingAdminMfa(database, id, "replacement")).toBeUndefined();
  expect(await mfa.findAdminMfa(database, id)).toMatchObject({
    encryptedSecret: "cipher",
    lastUsedStep: 0,
  });
});

test("AUTH-009 enforces account PK/FK and RESTRICT to preserve the tombstone reference", async () => {
  const id = await createAccount();
  await mfa.incrementAdminMfaVersion(database, id);
  await expect(client`insert into admin_mfa (account_id) values (${id})`).rejects.toMatchObject({
    code: "23505",
    constraint_name: "admin_mfa_pkey",
  });
  await expect(client`insert into admin_mfa (account_id) values (-1)`).rejects.toMatchObject({
    code: "23503",
    constraint_name: "admin_mfa_account_id_fkey",
  });
  await expect(client`delete from account where id = ${id}`).rejects.toMatchObject({
    code: "23503",
    constraint_name: "admin_mfa_account_id_fkey",
  });
});

test("AUTH-009 concurrent first setup returns the stored pending snapshot to both callers", async () => {
  const id = await createAccount();
  let release!: () => void;
  let ready!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const inserted = new Promise<void>((resolve) => {
    ready = resolve;
  });
  const first = database.transaction(async (tx) => {
    const row = await mfa.ensurePendingAdminMfa(tx, id, "winner-cipher");
    ready();
    await held;
    return row;
  });
  await Promise.race([inserted, first]);
  const second = mfa.ensurePendingAdminMfa(database, id, "loser-cipher");
  const results = Promise.allSettled([first, second]);
  try {
    let blocked = false;
    for (let attempt = 0; attempt < 200; attempt += 1) {
      const [row] = await client`select exists (
        select 1 from pg_locks l join pg_stat_activity a on a.pid = l.pid
        where a.datname = current_database() and l.locktype = 'transactionid' and not l.granted
      ) as blocked`;
      if (row?.blocked) {
        blocked = true;
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    expect(blocked).toBe(true);
  } finally {
    release();
    await first;
  }
  const responses = await results;
  const stored = await mfa.findAdminMfa(database, id);
  expect(responses).toEqual([
    { status: "fulfilled", value: stored },
    { status: "fulfilled", value: stored },
  ]);
  expect(stored).toMatchObject({ encryptedSecret: "winner-cipher", version: 1 });
  expect(await mfa.ensurePendingAdminMfa(database, id, "retry-cipher")).toEqual(stored);
});

test("AUTH-009 reset preserves the row/version, stale reset fails, and re-enrollment keeps version", async () => {
  const id = await createAccount();
  await mfa.ensurePendingAdminMfa(database, id, "cipher");
  const resets = await Promise.all([
    mfa.resetAdminMfa(database, id, 1),
    mfa.resetAdminMfa(database, id, 1),
  ]);
  expect(resets.filter((rows) => rows.length === 1)).toEqual([[{ version: 2 }]]);
  expect(await mfa.findAdminMfa(database, id)).toMatchObject({
    encryptedSecret: null,
    enabledAt: null,
    lastUsedStep: null,
    version: 2,
  });
  expect(await mfa.ensurePendingAdminMfa(database, id, "new-cipher")).toMatchObject({
    encryptedSecret: "new-cipher",
    version: 2,
  });
});

test("AUTH-006/009 concurrent version increases preserve enabled secret and consumed step", async () => {
  const id = await createAccount();
  await database.insert(schema.adminMfa).values({
    accountId: id,
    encryptedSecret: "cipher",
    enabledAt: "2026-10-10T00:00:00Z",
    lastUsedStep: 123,
  });
  const versions = await Promise.all([
    mfa.incrementAdminMfaVersion(database, id),
    mfa.incrementAdminMfaVersion(database, id),
  ]);
  expect(
    versions
      .flat()
      .map((row) => row.version)
      .sort(),
  ).toEqual([2, 3]);
  expect(await mfa.findAdminMfa(database, id)).toMatchObject({
    encryptedSecret: "cipher",
    lastUsedStep: 123,
    version: 3,
  });
  expect(await mfa.resetAdminMfa(database, id, 3)).toEqual([{ version: 4 }]);
  await database
    .update(schema.account)
    .set({ status: "DELETED", deletedAt: "2026-10-10T00:00:00Z" })
    .where(eq(schema.account.id, id));
  expect(await mfa.findAdminMfa(database, id)).toMatchObject({
    accountId: id,
    encryptedSecret: null,
    version: 4,
  });
});

test("AUTH-009 caller transaction rolls back Account change and MFA version/reset together", async () => {
  const id = await createAccount();
  await mfa.ensurePendingAdminMfa(database, id, "cipher");
  const before = await mfa.findAdminMfa(database, id);
  await expect(
    database.transaction(async (tx) => {
      await tx.update(schema.account).set({ role: "USER" }).where(eq(schema.account.id, id));
      await mfa.incrementAdminMfaVersion(tx, id);
      await mfa.resetAdminMfa(tx, id, 2);
      throw new Error("rollback fixture");
    }),
  ).rejects.toThrow("rollback fixture");
  expect(await mfa.findAdminMfa(database, id)).toEqual(before);
  expect(
    await database.query.account.findFirst({ where: eq(schema.account.id, id) }),
  ).toMatchObject({ role: "ADMIN" });
});
