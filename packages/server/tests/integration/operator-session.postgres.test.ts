import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { buildAbility } from "../../src/auth/ability";
import * as auth from "../../src/services/operator-auth-service";
import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";
import * as sessions from "../../src/repositories/operator-session-repository";

vi.mock("../../src/db", () => ({ getDatabase: () => db }));
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Isolated local operator database required");
const client = postgres(url.toString(), { max: 4 });
const db = drizzle(client, { schema });
const accountId = createEntityId();
const ids: string[] = [];
const now = "2026-10-31T00:00:00.000Z";
const hash = () => createHash("sha256").update(randomBytes(32)).digest("hex");
async function pending(expiresAt = "2026-10-31T00:10:00.000Z") {
  const row = await sessions.insertOperatorSession(db, {
    deviceHash: hash(),
    userCodeHash: hash(),
    createdAt: now,
    expiresAt,
  });
  ids.push(row.id);
  return row;
}
beforeAll(async () => {
  await db.insert(schema.account).values({ id: accountId, role: "ADMIN", status: "ACTIVE" });
});
afterAll(async () => {
  if (ids.length)
    await db.delete(schema.operatorSession).where(inArray(schema.operatorSession.id, ids));
  await db.delete(schema.adminMfa).where(eq(schema.adminMfa.accountId, accountId));
  await db.delete(schema.account).where(eq(schema.account.id, accountId));
  await client.end();
});
test("미승인 연결은 token을 발급하지 않으며 승인자는 한 번만 정한다", async () => {
  const row = await pending();
  const token = { tokenHash: hash(), tokenExpiresAt: "2026-10-31T08:00:00.000Z" };
  expect(await sessions.exchangeOperatorSession(db, row.deviceHash, token, now)).toBeUndefined();
  expect(
    await sessions.approveOperatorSession(db, row.userCodeHash, { accountId, mfaVersion: 1 }, now),
  ).toMatchObject({ accountId, mfaVersion: 1 });
  expect(
    await sessions.approveOperatorSession(db, row.userCodeHash, { accountId, mfaVersion: 2 }, now),
  ).toBeUndefined();
});
test("동시 token 교환은 한 번만 성공하고 재교환·로그아웃 뒤 사용을 거절한다", async () => {
  const row = await pending();
  await sessions.approveOperatorSession(db, row.userCodeHash, { accountId, mfaVersion: 1 }, now);
  const tokens = [hash(), hash()];
  const results = await Promise.all(
    tokens.map((tokenHash) =>
      sessions.exchangeOperatorSession(
        db,
        row.deviceHash,
        { tokenHash, tokenExpiresAt: "2026-10-31T08:00:00.000Z" },
        now,
      ),
    ),
  );
  expect(results.filter(Boolean)).toHaveLength(1);
  const applied = results.find(Boolean)!;
  expect(await sessions.findOperatorSessionByToken(db, applied.tokenHash!, now)).toMatchObject({
    id: row.id,
  });
  expect(
    await sessions.exchangeOperatorSession(
      db,
      row.deviceHash,
      { tokenHash: hash(), tokenExpiresAt: "2026-10-31T08:00:00.000Z" },
      now,
    ),
  ).toBeUndefined();
  expect(await sessions.revokeOperatorSession(db, applied.tokenHash!, now)).toEqual({ id: row.id });
  expect(await sessions.findOperatorSessionByToken(db, applied.tokenHash!, now)).toBeUndefined();
});
test("grant·token의 정확한 만료 시각에는 승인·교환·인증을 허용하지 않는다", async () => {
  const row = await pending();
  expect(
    await sessions.approveOperatorSession(
      db,
      row.userCodeHash,
      { accountId, mfaVersion: 1 },
      row.expiresAt,
    ),
  ).toBeUndefined();
  await sessions.approveOperatorSession(db, row.userCodeHash, { accountId, mfaVersion: 1 }, now);
  expect(
    await sessions.exchangeOperatorSession(
      db,
      row.deviceHash,
      { tokenHash: hash(), tokenExpiresAt: "2026-10-31T08:00:00.000Z" },
      row.expiresAt,
    ),
  ).toBeUndefined();
  const tokenHash = hash();
  await sessions.exchangeOperatorSession(
    db,
    row.deviceHash,
    { tokenHash, tokenExpiresAt: "2026-10-31T08:00:00.000Z" },
    now,
  );
  expect(
    await sessions.findOperatorSessionByToken(db, tokenHash, "2026-10-31T08:00:00.000Z"),
  ).toBeUndefined();
});
test("DB도 해시 형식과 불완전한 승인·교환 상태를 거절한다", async () => {
  const row = await pending();
  for (const changes of [
    { deviceHash: "raw-secret" },
    { accountId },
    { approvedAt: now },
    { mfaVersion: 0 },
    { tokenHash: hash() },
    { exchangedAt: now },
    { revokedAt: now },
  ]) {
    await expect(
      db.update(schema.operatorSession).set(changes).where(eq(schema.operatorSession.id, row.id)),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  }
});
test("grant 만료만으로 활성 token을 정리하지 않으며 보존 기한 뒤에만 삭제한다", async () => {
  const row = await pending();
  await sessions.approveOperatorSession(db, row.userCodeHash, { accountId, mfaVersion: 1 }, now);
  const tokenHash = hash();
  await sessions.exchangeOperatorSession(
    db,
    row.deviceHash,
    { tokenHash, tokenExpiresAt: "2026-10-31T08:00:00.000Z" },
    now,
  );
  await sessions.purgeOperatorSessions(db, "2026-10-31T01:00:00.000Z");
  expect(
    await sessions.findOperatorSessionByToken(db, tokenHash, "2026-10-31T01:00:00.000Z"),
  ).toBeTruthy();
  await sessions.purgeOperatorSessions(db, "2026-11-01T08:00:00.000Z");
  expect(await sessions.findOperatorSessionByDevice(db, row.deviceHash)).toBeUndefined();
});

const context = (role: "ADMIN" | "USER" = "ADMIN") => ({
  user: { id: accountId },
  ability: buildAbility({ accountId, role }),
});
const time = new Date(now);
beforeEach(async () => {
  await db
    .update(schema.account)
    .set({ role: "ADMIN", status: "ACTIVE" })
    .where(eq(schema.account.id, accountId));
  await db
    .insert(schema.adminMfa)
    .values({
      accountId,
      encryptedSecret: "local-service-fixture",
      enabledAt: now,
      lastUsedStep: 1,
      version: 1,
    })
    .onConflictDoUpdate({
      target: schema.adminMfa.accountId,
      set: {
        encryptedSecret: "local-service-fixture",
        enabledAt: now,
        lastUsedStep: 1,
        version: 1,
      },
    });
});
async function grant() {
  const result = await auth.createOperatorGrant(time);
  const row = await sessions.findOperatorSessionByDevice(
    db,
    createHash("sha256").update(result.deviceCode).digest("hex"),
  );
  ids.push(row!.id);
  return { result, row: row! };
}
async function token() {
  const { result } = await grant();
  await auth.approveOperatorGrant(context(), 1, result.userCode, time);
  const exchange = await auth.exchangeOperatorGrant(result.deviceCode, time);
  if (exchange.status !== "authorized") throw Error("Expected authorized exchange");
  return exchange.accessToken;
}
test("실제 서비스는 비밀 해시만 저장하고 10분 승인·8시간 token으로 연결한다", async () => {
  const { result, row } = await grant();
  expect(row.deviceHash).not.toBe(result.deviceCode);
  expect(row.userCodeHash).toBe(createHash("sha256").update(result.userCode).digest("hex"));
  expect(JSON.stringify(row)).not.toContain(result.userCode);
  expect(Date.parse(result.expiresAt) - time.getTime()).toBe(600000);
  expect(await auth.exchangeOperatorGrant(result.deviceCode, time)).toEqual({ status: "pending" });
  await auth.approveOperatorGrant(context(), 1, result.userCode, time);
  const exchanged = await auth.exchangeOperatorGrant(result.deviceCode, time);
  expect(exchanged.status).toBe("authorized");
  if (exchanged.status !== "authorized") throw Error("Expected authorized exchange");
  expect(Date.parse(exchanged.expiresAt) - time.getTime()).toBe(28800000);
  const stored = await sessions.findOperatorSessionByDevice(
    db,
    createHash("sha256").update(result.deviceCode).digest("hex"),
  );
  expect(stored!.tokenHash).toBe(createHash("sha256").update(exchanged.accessToken).digest("hex"));
  expect(JSON.stringify(stored)).not.toContain(exchanged.accessToken);

  expect(await auth.authorizeOperatorToken(exchanged.accessToken, time)).toMatchObject({
    accountId,
  });
  await expect(auth.exchangeOperatorGrant(result.deviceCode, time)).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await expect(
    auth.authorizeOperatorToken(exchanged.accessToken, new Date(exchanged.expiresAt)),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  await auth.revokeOperatorToken(exchanged.accessToken, time);
  await expect(auth.authorizeOperatorToken(exchanged.accessToken, time)).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
});
test("비관리자·없는 브라우저 증명·회수된 MFA 증명으로 연결을 승인하지 않는다", async () => {
  const { result } = await grant();
  await expect(
    auth.approveOperatorGrant(context("USER"), 1, result.userCode, time),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  await expect(
    auth.approveOperatorGrant(context(), 2, result.userCode, time),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
  await expect(
    auth.approveOperatorGrant(
      { user: null, ability: buildAbility({ accountId: null, role: null }) },
      1,
      result.userCode,
      time,
    ),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
});
test("발급 후 MFA version·권한·계정 상태·MFA 활성 변경은 다음 요청부터 거절한다", async () => {
  const accessToken = await token();
  await db
    .update(schema.adminMfa)
    .set({ version: 2 })
    .where(eq(schema.adminMfa.accountId, accountId));
  await expect(auth.authorizeOperatorToken(accessToken, time)).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await db
    .update(schema.adminMfa)
    .set({ version: 1 })
    .where(eq(schema.adminMfa.accountId, accountId));
  for (const fields of [
    { role: "USER" as const },
    { role: "ADMIN" as const, status: "SUSPENDED" as const },
  ]) {
    await db.update(schema.account).set(fields).where(eq(schema.account.id, accountId));
    await expect(auth.authorizeOperatorToken(accessToken, time)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
  }
  await db
    .update(schema.account)
    .set({ role: "ADMIN", status: "ACTIVE" })
    .where(eq(schema.account.id, accountId));
  await db
    .update(schema.adminMfa)
    .set({ enabledAt: null, lastUsedStep: null })
    .where(eq(schema.adminMfa.accountId, accountId));
  await expect(auth.authorizeOperatorToken(accessToken, time)).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
});
test("승인 뒤 MFA를 회수했거나 grant가 만료되면 token을 교환하지 않는다", async () => {
  const { result } = await grant();
  await auth.approveOperatorGrant(context(), 1, result.userCode, time);
  await db
    .update(schema.adminMfa)
    .set({ version: 2 })
    .where(eq(schema.adminMfa.accountId, accountId));
  await expect(auth.exchangeOperatorGrant(result.deviceCode, time)).rejects.toMatchObject({
    code: "UNAUTHENTICATED",
  });
  await expect(
    auth.exchangeOperatorGrant(result.deviceCode, new Date(result.expiresAt)),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
});

test("연결 코드 충돌만 재할당 대상으로 분류하고 다른 SQL 제약 오류는 보존한다", async () => {
  const row = await pending();
  const input = { createdAt: now, expiresAt: row.expiresAt };
  for (const keys of [
    { deviceHash: row.deviceHash, userCodeHash: hash() },
    { deviceHash: hash(), userCodeHash: row.userCodeHash },
  ]) {
    await expect(sessions.insertOperatorSession(db, { ...input, ...keys })).rejects.toBeInstanceOf(
      sessions.OperatorSessionConflictError,
    );
  }
  await expect(
    sessions.insertOperatorSession(db, { ...input, deviceHash: "invalid", userCodeHash: hash() }),
  ).rejects.toMatchObject({ cause: { code: "23514" } });
});
