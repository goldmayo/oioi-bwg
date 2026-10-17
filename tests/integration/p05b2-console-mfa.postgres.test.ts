import { createRequire } from "node:module";
import { eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, afterEach, beforeEach, expect, test, vi } from "vitest";

import { decryptAdminMfaSecret } from "@oioi-bwg/server/auth/admin-mfa-crypto";
import { getDatabase } from "@oioi-bwg/server/db";
import * as schema from "@oioi-bwg/server/db/schema";
import * as mfa from "@oioi-bwg/server/repositories/admin-mfa-repository";
import {
  authenticateConsoleMfa,
  confirmConsoleMfa,
  setupConsoleMfa,
} from "@oioi-bwg/server/services/console-mfa-service";
import {
  changeConsoleAccountAccess,
  resetConsoleMfa,
} from "@oioi-bwg/server/services/console-mfa-revocation-service";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !new Set(["localhost", "127.0.0.1"]).has(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
) {
  throw new Error("Refusing a non-isolated PostgreSQL integration database");
}
const database = getDatabase();
const observer = postgres(url.toString(), { max: 2, connection: { statement_timeout: 10_000 } });
const key = Buffer.alloc(32, 9);
const password = "P04-fixture-pass1!";
const { generateSync } = createRequire(
  new URL("../../packages/server/package.json", import.meta.url),
)("otplib");
const epoch = 1_234_567_890;
const token = (secret: string, offset = 0) =>
  generateSync({ secret, epoch: epoch + offset, period: 30, digits: 6, algorithm: "sha1" });
const passwordHash =
  "$argon2id$v=19$m=19456,p=1,t=2$cDA0LWJyb3dzZXItZml4dHVyZS1zYWx0$B2TTF8IxGl6mwC9jStRh3/z88pnDsCMwg9Ft8nslGpY";
beforeEach(() => {
  vi.spyOn(Date, "now").mockReturnValue(epoch * 1000);
});
afterEach(() => vi.restoreAllMocks());
afterAll(async () => {
  await observer.end();
  await database.$client.end();
});

async function accountFixture() {
  const [account] = await database
    .insert(schema.account)
    .values({ role: "ADMIN", status: "ACTIVE" })
    .returning();
  const id = account!.id;
  const email = `p05b2-${id}@example.invalid`;
  await database.insert(schema.passwordCredential).values({
    accountId: id,
    email,
    passwordHash,
    emailVerifiedAt: "2026-10-10T00:00:00Z",
    passwordChangedAt: "2026-10-10T00:00:00Z",
  });
  return { id, email };
}

async function enabledFixture() {
  const account = await accountFixture();
  const pending = await setupConsoleMfa(account.email, password, key);
  await confirmConsoleMfa(account.email, password, token(pending.secret), pending.version, key);
  vi.mocked(Date.now).mockReturnValue((epoch + 30) * 1000);
  return { ...account, ...pending };
}

function gate() {
  let release!: () => void;
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { wait, release };
}

// 일정만 제어하는 spy다. SQL/transaction/lock은 모두 실제 runtime app role로 실행한다.
async function raceAfterVerification<T>(
  operation: () => Promise<T>,
  concurrent: () => Promise<unknown>,
) {
  const ready = gate();
  const resume = gate();
  const original = mfa.lockConsoleAuthenticationFacts;
  vi.spyOn(mfa, "lockConsoleAuthenticationFacts").mockImplementationOnce(async (...args) => {
    ready.release();
    await resume.wait;
    return original(...args);
  });
  const result = operation();
  const settled = result.then(
    (value) => ({ value }),
    (error: unknown) => ({ error }),
  );
  try {
    await Promise.race([
      ready.wait,
      result.then(() => {
        throw new Error("검증 후 lock 진입이 필요함");
      }),
    ]);
    await concurrent();
  } finally {
    resume.release();
    await settled;
  }
  return settled;
}

async function expectDatabaseLockWait() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const [row] =
      await observer`select exists (select 1 from pg_locks l join pg_stat_activity a on a.pid=l.pid where a.datname=current_database() and l.locktype='transactionid' and not l.granted) as blocked`;
    if (row?.blocked) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error("실제 PostgreSQL lock 대기를 관찰해야 함");
}

test("AUTH-009 setup returns one stored pending secret/version; confirm consumes the first OTP without identity", async () => {
  const { id, email } = await accountFixture();
  const responses = await Promise.all([
    setupConsoleMfa(email.toUpperCase(), password, key),
    setupConsoleMfa(email, password, key),
  ]);
  const stored = await mfa.findAdminMfa(database, id);
  expect(responses).toEqual(
    Array(2).fill({
      secret: decryptAdminMfaSecret(id, stored!.encryptedSecret!, key),
      version: stored!.version,
    }),
  );
  const [pending] = responses;
  await expect(
    authenticateConsoleMfa(email, password, token(pending!.secret), key),
  ).resolves.toBeNull();
  await expect(
    confirmConsoleMfa(email, password, token(pending!.secret), 2, key),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  const confirms = await Promise.allSettled(
    Array.from({ length: 2 }, () =>
      confirmConsoleMfa(email, password, token(pending!.secret), 1, key),
    ),
  );
  expect(confirms.filter((r) => r.status === "fulfilled")).toEqual([
    { status: "fulfilled", value: undefined },
  ]);
  expect(await mfa.findAdminMfa(database, id)).toMatchObject({
    lastUsedStep: epoch / 30,
    version: 1,
  });
  await expect(
    authenticateConsoleMfa(email, password, token(pending!.secret), key),
  ).resolves.toBeNull();
  await expect(setupConsoleMfa(email, password, key)).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
});

test("AUTH-009 concurrent equal OTPs wait on PostgreSQL and exactly one UPDATE returns an identity", async () => {
  const fixture = await enabledFixture();
  const ready = gate();
  const resume = gate();
  const original = mfa.consumeAdminMfaStep;
  vi.spyOn(mfa, "consumeAdminMfaStep").mockImplementationOnce(async (...args) => {
    const rows = await original(...args);
    expect(rows).toHaveLength(1);
    ready.release();
    await resume.wait;
    return rows;
  });
  const login = () =>
    authenticateConsoleMfa(fixture.email, password, token(fixture.secret, 30), key);
  const first = login();
  await Promise.race([
    ready.wait,
    first.then(() => {
      throw new Error("UPDATE 보류가 필요함");
    }),
  ]);
  const second = login();
  const results = Promise.all([first, second]);
  try {
    await expectDatabaseLockWait();
  } finally {
    resume.release();
  }
  expect((await results).filter(Boolean)).toEqual([
    { id: fixture.id.toString(), mfaVerified: true, mfaVersion: 1 },
  ]);
  expect(await mfa.findAdminMfa(database, fixture.id)).toMatchObject({
    lastUsedStep: (epoch + 30) / 30,
  });
});

test("AUTH-009 reset after TOTP verification rejects stale login and preserves version through re-enrollment", async () => {
  const f = await enabledFixture();
  const result = await raceAfterVerification(
    () => authenticateConsoleMfa(f.email, password, token(f.secret, 30), key),
    () => resetConsoleMfa(f.id, 1),
  );
  expect(result).toEqual({ value: null });
  expect(await mfa.findAdminMfa(database, f.id)).toMatchObject({
    encryptedSecret: null,
    enabledAt: null,
    lastUsedStep: null,
    version: 2,
  });
  const pending = await setupConsoleMfa(f.email, password, key);
  expect(pending.version).toBe(2);
  expect(pending.secret).not.toBe(f.secret);
  await expect(
    confirmConsoleMfa(f.email, password, token(pending.secret, 30), 1, key),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  await confirmConsoleMfa(f.email, password, token(pending.secret, 30), 2, key);
});

test("AUTH-009 reset after pending verification rejects confirm without restoring the old secret", async () => {
  const f = await accountFixture();
  const pending = await setupConsoleMfa(f.email, password, key);
  expect(
    await raceAfterVerification(
      () => confirmConsoleMfa(f.email, password, token(pending.secret), 1, key),
      () => resetConsoleMfa(f.id, 1),
    ),
  ).toMatchObject({ error: { code: "UNAUTHENTICATED" } });
  expect(await mfa.findAdminMfa(database, f.id)).toMatchObject({
    encryptedSecret: null,
    enabledAt: null,
    version: 2,
  });
});

test("AUTH-009 role/status changes and restoration preserve the secret but never restore the old MFA version", async () => {
  const f = await enabledFixture();
  const before = await mfa.findAdminMfa(database, f.id);
  expect(
    await raceAfterVerification(
      () => authenticateConsoleMfa(f.email, password, token(f.secret, 30), key),
      () =>
        changeConsoleAccountAccess(
          f.id,
          { role: "ADMIN", status: "ACTIVE", version: 1 },
          { role: "USER", status: "ACTIVE" },
        ),
    ),
  ).toEqual({ value: null });
  await expect(
    authenticateConsoleMfa(f.email, password, token(f.secret, 30), key),
  ).resolves.toBeNull();
  await changeConsoleAccountAccess(
    f.id,
    { role: "USER", status: "ACTIVE", version: 2 },
    { role: "ADMIN", status: "ACTIVE" },
  );
  expect(
    await raceAfterVerification(
      () => authenticateConsoleMfa(f.email, password, token(f.secret, 30), key),
      () =>
        changeConsoleAccountAccess(
          f.id,
          { role: "ADMIN", status: "ACTIVE", version: 3 },
          { role: "ADMIN", status: "SUSPENDED" },
        ),
    ),
  ).toEqual({ value: null });
  await expect(
    authenticateConsoleMfa(f.email, password, token(f.secret, 30), key),
  ).resolves.toBeNull();
  await changeConsoleAccountAccess(
    f.id,
    { role: "ADMIN", status: "SUSPENDED", version: 4 },
    { role: "ADMIN", status: "ACTIVE" },
  );
  expect(await mfa.findAdminMfa(database, f.id)).toMatchObject({ ...before, version: 5 });
  await expect(
    authenticateConsoleMfa(f.email, password, token(f.secret, 30), key),
  ).resolves.toMatchObject({ mfaVersion: 5 });
});

test("AUTH-009 rechecks credential email/hash/timestamps/deletion after OTP verification", async () => {
  for (const field of ["email", "passwordHash", "passwordChangedAt", "deleted"] as const) {
    const f = await enabledFixture();
    expect(
      await raceAfterVerification(
        () => authenticateConsoleMfa(f.email, password, token(f.secret, 30), key),
        async () => {
          if (field === "deleted")
            await database
              .delete(schema.passwordCredential)
              .where(eq(schema.passwordCredential.accountId, f.id));
          else
            await database
              .update(schema.passwordCredential)
              .set(
                field === "email"
                  ? { email: `changed-${f.email}` }
                  : field === "passwordHash"
                    ? { passwordHash: "replaced" }
                    : { passwordChangedAt: "2026-10-11T00:00:00Z" },
              )
              .where(eq(schema.passwordCredential.accountId, f.id));
        },
      ),
    ).toEqual({ value: null });
    expect(await mfa.findAdminMfa(database, f.id)).toMatchObject({ lastUsedStep: epoch / 30 });
  }
});

test("AUTH-009 conditional SQL rejects stale encrypted secret, version, activation, and consumed steps", async () => {
  const f = await enabledFixture();
  const stored = (await mfa.findAdminMfa(database, f.id))!;
  const expected = { ...stored, encryptedSecret: stored.encryptedSecret! };
  for (const change of [{ encryptedSecret: "different" }, { version: 2 }, { enabledAt: null }]) {
    expect(
      await mfa.consumeAdminMfaStep(
        database,
        { ...expected, ...change },
        (epoch + 30) / 30,
        "2026-10-10T00:00:00Z",
      ),
    ).toHaveLength(0);
  }
  expect(
    await mfa.consumeAdminMfaStep(database, expected, epoch / 30, "2026-10-10T00:00:00Z"),
  ).toHaveLength(0);
});

test("AUTH-009 expected-value failures and PostgreSQL version overflow roll back Account and MFA", async () => {
  const f = await enabledFixture();
  const before = await mfa.findAdminMfa(database, f.id);
  const expected = { role: "ADMIN", status: "ACTIVE", version: 1 } as const;
  const next = { role: "USER", status: "SUSPENDED" } as const;
  for (const invalid of [
    { ...expected, version: null },
    { ...expected, version: 2 },
    { ...expected, role: "USER" as const },
  ]) {
    await expect(changeConsoleAccountAccess(f.id, invalid, next)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  }
  expect(await mfa.findAdminMfa(database, f.id)).toEqual(before);
  await database
    .update(schema.adminMfa)
    .set({ version: 2_147_483_647 })
    .where(eq(schema.adminMfa.accountId, f.id));
  const atLimit = await mfa.findAdminMfa(database, f.id);
  await expect(
    changeConsoleAccountAccess(f.id, { ...expected, version: 2_147_483_647 }, next),
  ).rejects.toMatchObject({ cause: { code: "22003" } });
  expect(
    await database.query.account.findFirst({ where: eq(schema.account.id, f.id) }),
  ).toMatchObject({ role: "ADMIN", status: "ACTIVE" });
  expect(await mfa.findAdminMfa(database, f.id)).toEqual(atLimit);
  await expect(resetConsoleMfa(f.id, 2_147_483_647)).rejects.toMatchObject({
    cause: { code: "22003" },
  });
  expect(await mfa.findAdminMfa(database, f.id)).toEqual(atLimit);
});

test("AUTH-009 absent MFA expected version creates once, and stale reset/access cannot silently increment", async () => {
  const f = await accountFixture();
  const resets = await Promise.allSettled([
    resetConsoleMfa(f.id, null),
    resetConsoleMfa(f.id, null),
  ]);
  expect(resets.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect(await mfa.findAdminMfa(database, f.id)).toMatchObject({
    encryptedSecret: null,
    version: 1,
  });
  await expect(resetConsoleMfa(f.id, null)).rejects.toMatchObject({ code: "FORBIDDEN" });
  const other = await accountFixture();
  await changeConsoleAccountAccess(
    other.id,
    { role: "ADMIN", status: "ACTIVE", version: null },
    { role: "USER", status: "ACTIVE" },
  );
  expect(await mfa.findAdminMfa(database, other.id)).toMatchObject({
    encryptedSecret: null,
    version: 1,
  });
});

test("AUTH-009 invalid password, missing credential, nonADMIN/status, malformed OTP never consume a step", async () => {
  const f = await enabledFixture();
  await expect(
    authenticateConsoleMfa("missing@example.invalid", password, token(f.secret, 30), key),
  ).resolves.toBeNull();
  await expect(
    authenticateConsoleMfa(f.email, "wrong", token(f.secret, 30), key),
  ).resolves.toBeNull();
  await expect(
    authenticateConsoleMfa(f.email, password, undefined as unknown as string, key),
  ).resolves.toBeNull();
  await database
    .update(schema.account)
    .set({ status: "PENDING_VERIFICATION" })
    .where(eq(schema.account.id, f.id));
  await expect(setupConsoleMfa(f.email, password, key)).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await expect(
    changeConsoleAccountAccess(
      f.id,
      { role: "ADMIN", status: "ACTIVE", version: 1 },
      { role: "ADMIN", status: "ACTIVE" },
    ),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await mfa.findAdminMfa(database, f.id)).toMatchObject({ lastUsedStep: epoch / 30 });
});

test("AUTH-009 stores the actual future matched step and refuses its replay", async () => {
  const f = await enabledFixture();
  await expect(
    authenticateConsoleMfa(f.email, password, token(f.secret, 60), key),
  ).resolves.toMatchObject({ mfaVersion: 1 });
  expect(await mfa.findAdminMfa(database, f.id)).toMatchObject({ lastUsedStep: (epoch + 60) / 30 });
  await expect(
    authenticateConsoleMfa(f.email, password, token(f.secret, 60), key),
  ).resolves.toBeNull();
});

test("AUTH-009 setup holding Account lock makes missing-version access fail after the row appears", async () => {
  const f = await accountFixture();
  const ready = gate();
  const resume = gate();
  const original = mfa.ensurePendingAdminMfa;
  vi.spyOn(mfa, "ensurePendingAdminMfa").mockImplementationOnce(async (...args) => {
    const row = await original(...args);
    ready.release();
    await resume.wait;
    return row;
  });
  const setup = setupConsoleMfa(f.email, password, key);
  await Promise.race([
    ready.wait,
    setup.then(() => {
      throw new Error("pending 생성 보류가 필요함");
    }),
  ]);
  const access = changeConsoleAccountAccess(
    f.id,
    { role: "ADMIN", status: "ACTIVE", version: null },
    { role: "USER", status: "ACTIVE" },
  );
  const results = Promise.allSettled([setup, access]);
  try {
    await expectDatabaseLockWait();
  } finally {
    resume.release();
  }
  const [setupResult, accessResult] = await results;
  expect(setupResult!.status).toBe("fulfilled");
  expect(accessResult).toMatchObject({ status: "rejected", reason: { code: "FORBIDDEN" } });
  expect(
    await database.query.account.findFirst({ where: eq(schema.account.id, f.id) }),
  ).toMatchObject({ role: "ADMIN" });
  expect(await mfa.findAdminMfa(database, f.id)).toMatchObject({ version: 1 });
});

test("AUTH-009 login winning the lock commits before reset and its returned version becomes stale", async () => {
  const f = await enabledFixture();
  const ready = gate();
  const resume = gate();
  const original = mfa.consumeAdminMfaStep;
  vi.spyOn(mfa, "consumeAdminMfaStep").mockImplementationOnce(async (...args) => {
    const rows = await original(...args);
    ready.release();
    await resume.wait;
    return rows;
  });
  const login = authenticateConsoleMfa(f.email, password, token(f.secret, 30), key);
  await Promise.race([
    ready.wait,
    login.then(() => {
      throw new Error("로그인 commit 보류가 필요함");
    }),
  ]);
  const reset = resetConsoleMfa(f.id, 1);
  const results = Promise.all([login, reset]);
  try {
    await expectDatabaseLockWait();
  } finally {
    resume.release();
  }
  const [identity, revoked] = await results;
  expect(identity).toMatchObject({ mfaVersion: 1 });
  expect(revoked.version).toBe(2);
  expect(await mfa.findAdminMfa(database, f.id)).toMatchObject({
    encryptedSecret: null,
    version: 2,
  });
});
