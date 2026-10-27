import { and, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, expect, test } from "vitest";

import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";

const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Refusing non-isolated notification database");
const client = postgres(url.toString(), { max: 4 });
const db = drizzle(client, { schema });
const accountIds = [createEntityId(), createEntityId()];
const ids: string[] = [];
afterAll(async () => {
  if (ids.length) {
    await db
      .delete(schema.notificationDelivery)
      .where(inArray(schema.notificationDelivery.notificationId, ids));
    await db.delete(schema.notification).where(inArray(schema.notification.id, ids));
  }
  await db
    .delete(schema.pushInstallation)
    .where(inArray(schema.pushInstallation.accountId, accountIds));
  await db.delete(schema.account).where(inArray(schema.account.id, accountIds));
  await client.end();
});

test("같은 사건은 수신자별 한 건이며 동시 생성은 DB가 중복을 막는다", async () => {
  await db
    .insert(schema.account)
    .values(accountIds.map((id) => ({ id, status: "ACTIVE" as const, role: "ADMIN" as const })));
  const resourceId = createEntityId();
  const input = {
    recipientAccountId: accountIds[0]!,
    type: "WAVEFORM_SUCCEEDED" as const,
    resourceType: "WAVEFORM_JOB" as const,
    resourceId,
    eventKey: resourceId,
  };
  const attempts = await Promise.all(
    Array.from({ length: 4 }, () =>
      db.insert(schema.notification).values(input).onConflictDoNothing().returning(),
    ),
  );
  ids.push(...attempts.flat().map((row) => row.id));
  expect(attempts.flat()).toHaveLength(1);
  const [other] = await db
    .insert(schema.notification)
    .values({ ...input, recipientAccountId: accountIds[1]! })
    .returning();
  ids.push(other!.id);
  expect(other!.recipientAccountId).toBe(accountIds[1]);
});

test("발송 대기와 알림을 rollback하면 어느 쪽도 남지 않는다", async () => {
  const [installation] = await db
    .insert(schema.pushInstallation)
    .values({
      fid: `c${createEntityId().replaceAll("-", "")}`,
      accountId: accountIds[0]!,
      mfaVersion: 1,
      expiresAt: new Date(Date.now() + 3600_000).toISOString(),
    })
    .returning();
  const id = createEntityId();
  ids.push(id);
  await expect(
    db.transaction(async (tx) => {
      await tx.insert(schema.notification).values({
        id,
        recipientAccountId: accountIds[0]!,
        type: "WAVEFORM_FAILED",
        resourceType: "WAVEFORM_JOB",
        resourceId: createEntityId(),
        eventKey: id,
      });
      await tx.insert(schema.notificationDelivery).values({
        notificationId: id,
        installationId: installation!.id,
        bindingVersion: 1,
        expiresAt: new Date(Date.now() + 3600_000).toISOString(),
      });
      throw new Error("rollback");
    }),
  ).rejects.toThrow("rollback");
  expect(await db.select().from(schema.notification).where(eq(schema.notification.id, id))).toEqual(
    [],
  );
  expect(
    await db
      .select()
      .from(schema.notificationDelivery)
      .where(eq(schema.notificationDelivery.notificationId, id)),
  ).toEqual([]);
});

test("lease와 attempt의 잘못된 조합을 DB가 거절한다", async () => {
  const [installation] = await db
    .select()
    .from(schema.pushInstallation)
    .where(eq(schema.pushInstallation.accountId, accountIds[0]!));
  const base = {
    notificationId: ids[0]!,
    installationId: installation!.id,
    bindingVersion: 1,
    expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  };
  for (const extra of [{ attemptCount: -1 }, { leaseToken: createEntityId(), leaseUntil: null }]) {
    await expect(
      db.insert(schema.notificationDelivery).values({ ...base, ...extra }),
    ).rejects.toMatchObject({ cause: { code: "23514" } });
  }
  const [row] = await db
    .select()
    .from(schema.notification)
    .where(
      and(
        eq(schema.notification.id, ids[0]!),
        eq(schema.notification.recipientAccountId, accountIds[0]!),
      ),
    );
  expect(row!.readAt).toBeNull();
});
