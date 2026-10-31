import { createHash, randomBytes } from "node:crypto";
import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, expect, test } from "vitest";
import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";
import * as sessions from "../../src/repositories/operator-session-repository";

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
