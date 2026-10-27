import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { buildAbility } from "../../src/auth/ability";
import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";
import {
  registerPushInstallation,
  releasePushInstallation,
  unregisterPushInstallation,
} from "../../src/services/push-installation-service";
vi.mock("../../src/db", () => ({ getDatabase: () => db }));
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Isolated local push database required");
const client = postgres(url.toString(), { max: 4 });
const db = drizzle(client, { schema });
const accounts = [createEntityId(), createEntityId()];
const ctx = (index = 0, role: "ADMIN" | "USER" = "ADMIN") => ({
  user: { id: accounts[index]! },
  ability: buildAbility({ accountId: accounts[index]!, role }),
});
const proof = () => ({ mfaVersion: 1, expiresAt: new Date(Date.now() + 3600_000).toISOString() });
const fid = `c${createEntityId().replaceAll("-", "")}`;
beforeAll(async () => {
  await db
    .insert(schema.account)
    .values(accounts.map((id) => ({ id, role: "ADMIN" as const, status: "ACTIVE" as const })));
  await db.insert(schema.adminMfa).values(
    accounts.map((accountId) => ({
      accountId,
      encryptedSecret: "fixture",
      enabledAt: new Date().toISOString(),
      lastUsedStep: 1,
      version: 1,
    })),
  );
});
afterAll(async () => {
  await db
    .delete(schema.pushInstallation)
    .where(inArray(schema.pushInstallation.accountId, accounts));
  await db.delete(schema.adminMfa).where(inArray(schema.adminMfa.accountId, accounts));
  await db.delete(schema.account).where(inArray(schema.account.id, accounts));
  await client.end();
});
async function row() {
  const [result] = await db
    .select()
    .from(schema.pushInstallation)
    .where(eq(schema.pushInstallation.fid, fid));
  return result!;
}

test("갱신은 binding을 보존하고 계정 전환·해제·만료 뒤 재등록은 이전 binding을 폐기한다", async () => {
  const first = await registerPushInstallation(ctx(), fid, proof());
  expect(await registerPushInstallation(ctx(), fid, proof())).toEqual(first);
  expect((await row()).bindingVersion).toBe(1);
  await registerPushInstallation(ctx(1), fid, proof());
  expect(await row()).toMatchObject({ accountId: accounts[1], bindingVersion: 2, enabled: true });
  await unregisterPushInstallation(ctx(), first.id);
  expect((await row()).enabled).toBe(true);
  await releasePushInstallation(accounts[1]!, first.id);
  await releasePushInstallation(accounts[1]!, first.id);
  expect(await row()).toMatchObject({ enabled: false, bindingVersion: 3 });
  await registerPushInstallation(ctx(), fid, proof());
  expect((await row()).bindingVersion).toBe(4);
  await db
    .update(schema.pushInstallation)
    .set({ expiresAt: "2000-01-01T00:00:00Z" })
    .where(eq(schema.pushInstallation.id, first.id));
  await registerPushInstallation(ctx(), fid, proof());
  expect((await row()).bindingVersion).toBe(5);
});
test("오래된 MFA 증명·회수·만료와 비관리자 등록을 거절한다", async () => {
  await expect(registerPushInstallation(ctx(0, "USER"), fid, proof())).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    registerPushInstallation(ctx(), fid, { ...proof(), expiresAt: "2000-01-01T00:00:00Z" }),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  await db
    .update(schema.adminMfa)
    .set({ version: 2 })
    .where(eq(schema.adminMfa.accountId, accounts[0]!));
  await expect(registerPushInstallation(ctx(), fid, proof())).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await registerPushInstallation(ctx(), fid, { ...proof(), mfaVersion: 2 });
  expect(await row()).toMatchObject({ mfaVersion: 2, bindingVersion: 6 });
});
