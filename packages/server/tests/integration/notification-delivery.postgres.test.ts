import { drizzle } from "drizzle-orm/postgres-js";
import { and, eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";
import {
  claimNotificationDelivery,
  finishNotificationDelivery,
} from "../../src/repositories/notification-delivery-repository";
import {
  dispatchNotifications,
  PushDeliveryError,
} from "../../src/services/notification-delivery-service";
vi.mock("../../src/db", () => ({ getDatabase: () => db }));
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Isolated local delivery database required");
const client = postgres(url.toString(), { max: 4 });
const db = drizzle(client, { schema });
const accountId = createEntityId();
const notificationIds: string[] = [];
const installationIds: string[] = [];
const future = () => new Date(Date.now() + 3600_000).toISOString();
beforeAll(async () => {
  await db.insert(schema.account).values({ id: accountId, role: "ADMIN", status: "ACTIVE" });
  await db.insert(schema.adminMfa).values({
    accountId,
    encryptedSecret: "fixture",
    enabledAt: new Date().toISOString(),
    lastUsedStep: 1,
    version: 1,
  });
});
afterAll(async () => {
  if (notificationIds.length) {
    await db
      .delete(schema.notificationDelivery)
      .where(inArray(schema.notificationDelivery.notificationId, notificationIds));
    await db.delete(schema.notification).where(inArray(schema.notification.id, notificationIds));
  }
  if (installationIds.length)
    await db
      .delete(schema.pushInstallation)
      .where(inArray(schema.pushInstallation.id, installationIds));
  await db.delete(schema.adminMfa).where(eq(schema.adminMfa.accountId, accountId));
  await db.delete(schema.account).where(eq(schema.account.id, accountId));
  await client.end();
});
async function fixture(count = 1) {
  const [notification] = await db
    .insert(schema.notification)
    .values({
      recipientAccountId: accountId,
      type: "WAVEFORM_SUCCEEDED",
      resourceType: "WAVEFORM_JOB",
      resourceId: createEntityId(),
      eventKey: createEntityId(),
    })
    .returning();
  notificationIds.push(notification!.id);
  const installations = await db
    .insert(schema.pushInstallation)
    .values(
      Array.from({ length: count }, () => ({
        fid: `c${createEntityId().replaceAll("-", "")}`,
        accountId,
        mfaVersion: 1,
        expiresAt: future(),
      })),
    )
    .returning();
  installationIds.push(...installations.map((row) => row.id));
  const rows = await db
    .insert(schema.notificationDelivery)
    .values(
      installations.map((installation) => ({
        notificationId: notification!.id,
        installationId: installation.id,
        bindingVersion: 1,
        expiresAt: future(),
      })),
    )
    .returning();
  return { notification: notification!, installations, rows };
}
test("동시 claim은 한 소유자만 얻고 만료 lease를 회수하면 이전 소유자는 반영하지 못한다", async () => {
  const { rows } = await fixture();
  const tokens = [createEntityId(), createEntityId()];
  const claimed = await Promise.all(tokens.map((token) => claimNotificationDelivery(db, token)));
  expect(claimed.filter(Boolean)).toHaveLength(1);
  const old = claimed.find(Boolean)!;
  await db
    .update(schema.notificationDelivery)
    .set({ leaseUntil: "2000-01-01T00:00:00Z" })
    .where(eq(schema.notificationDelivery.id, old.id));
  const token = createEntityId();
  const next = await claimNotificationDelivery(db, token);
  expect(next).toMatchObject({ id: rows[0]!.id, attemptCount: 2 });
  await finishNotificationDelivery(db, old.id, old.leaseToken!, {
    status: "ACCEPTED",
    lastErrorCode: null,
  });
  const [stillOwned] = await db
    .select()
    .from(schema.notificationDelivery)
    .where(eq(schema.notificationDelivery.id, old.id));
  expect(stillOwned!.leaseToken).toBe(token);
  await finishNotificationDelivery(db, old.id, token, {
    status: "DISCARDED",
    lastErrorCode: "TEST",
  });
});
test("일시 실패를 영속 재시도하고 FCM 접수 후에도 알림은 미읽음이다", async () => {
  const { rows, notification } = await fixture();
  const sender = vi.fn().mockRejectedValue(new PushDeliveryError("QUOTA", 60_000));
  await dispatchNotifications(sender);
  const [pending] = await db
    .select()
    .from(schema.notificationDelivery)
    .where(eq(schema.notificationDelivery.id, rows[0]!.id));
  expect(pending).toMatchObject({
    status: "PENDING",
    attemptCount: 1,
    lastErrorCode: "QUOTA",
    leaseToken: null,
  });
  expect(new Date(pending!.nextAttemptAt).getTime()).toBeGreaterThan(Date.now() + 50_000);
  await db
    .update(schema.notificationDelivery)
    .set({ nextAttemptAt: "2000-01-01T00:00:00Z" })
    .where(eq(schema.notificationDelivery.id, pending!.id));
  await dispatchNotifications(vi.fn().mockResolvedValue(undefined));
  const [accepted] = await db
    .select()
    .from(schema.notificationDelivery)
    .where(eq(schema.notificationDelivery.id, pending!.id));
  expect(accepted).toMatchObject({ status: "ACCEPTED", attemptCount: 2 });
  expect(accepted!.acceptedAt).not.toBeNull();
  expect(
    (
      await db.select().from(schema.notification).where(eq(schema.notification.id, notification.id))
    )[0]!.readAt,
  ).toBeNull();
});
test("여러 기기의 부분 실패를 독립 처리하고 무효 등록만 해제한다", async () => {
  const { rows, installations } = await fixture(2);
  await dispatchNotifications(async (target) => {
    if (target.installationId === installations[1]!.id) throw new PushDeliveryError("UNREGISTERED");
  });
  const result = await db
    .select()
    .from(schema.notificationDelivery)
    .where(
      inArray(
        schema.notificationDelivery.id,
        rows.map((row) => row.id),
      ),
    );
  expect(result.map((row) => row.status).sort()).toEqual(["ACCEPTED", "DISCARDED"]);
  expect(
    (
      await db
        .select()
        .from(schema.pushInstallation)
        .where(eq(schema.pushInstallation.id, installations[1]!.id))
    )[0]!.enabled,
  ).toBe(false);
});
test("재바인딩·MFA 회수·TTL 만료는 발송하지 않고 내역은 유지한다", async () => {
  for (const variant of ["binding", "mfa", "expiry"] as const) {
    const { notification, installations, rows } = await fixture();
    if (variant === "binding")
      await db
        .update(schema.pushInstallation)
        .set({ bindingVersion: 2 })
        .where(eq(schema.pushInstallation.id, installations[0]!.id));
    if (variant === "mfa")
      await db
        .update(schema.adminMfa)
        .set({ version: 2 })
        .where(eq(schema.adminMfa.accountId, accountId));
    if (variant === "expiry")
      await db
        .update(schema.notificationDelivery)
        .set({ expiresAt: "2000-01-01T00:00:00Z" })
        .where(eq(schema.notificationDelivery.id, rows[0]!.id));
    const sender = vi.fn();
    await dispatchNotifications(sender);
    expect(sender).not.toHaveBeenCalled();
    expect(
      (
        await db
          .select()
          .from(schema.notificationDelivery)
          .where(eq(schema.notificationDelivery.id, rows[0]!.id))
      )[0]!.status,
    ).toBe("DISCARDED");
    expect(
      await db
        .select()
        .from(schema.notification)
        .where(eq(schema.notification.id, notification.id)),
    ).toHaveLength(1);
    await db
      .update(schema.adminMfa)
      .set({ version: 1 })
      .where(eq(schema.adminMfa.accountId, accountId));
  }
});
test("FCM 접수 직후 crash는 재발송될 수 있지만 알림 내역은 한 건이다", async () => {
  const { notification, rows } = await fixture();
  const claimed = await claimNotificationDelivery(db, createEntityId());
  expect(claimed!.id).toBe(rows[0]!.id);
  const sender = vi.fn().mockResolvedValue(undefined);
  await sender();
  await db
    .update(schema.notificationDelivery)
    .set({ leaseUntil: "2000-01-01T00:00:00Z" })
    .where(eq(schema.notificationDelivery.id, rows[0]!.id));
  await dispatchNotifications(sender);
  expect(sender).toHaveBeenCalledTimes(2);
  expect(
    await db
      .select()
      .from(schema.notification)
      .where(
        and(
          eq(schema.notification.id, notification.id),
          eq(schema.notification.recipientAccountId, accountId),
        ),
      ),
  ).toHaveLength(1);
});
