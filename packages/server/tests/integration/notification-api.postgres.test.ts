import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { buildAbility } from "../../src/auth/ability";
import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";
import {
  getNotification,
  listNotifications,
  readAllNotifications,
  readNotification,
  recordWaveformNotification,
} from "../../src/services/notification-service";

vi.mock("../../src/db", () => ({ getDatabase: () => db }));
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Isolated local notification database required");
const client = postgres(url.toString(), { max: 4 });
const db = drizzle(client, { schema });
const owners = [createEntityId(), createEntityId()];
const ctx = (id = owners[0]!, role: "ADMIN" | "USER" = "ADMIN") => ({
  user: { id },
  ability: buildAbility({ accountId: id, role }),
});
const ids: string[] = [];
beforeAll(async () => {
  await db
    .insert(schema.account)
    .values(owners.map((id) => ({ id, role: "ADMIN" as const, status: "ACTIVE" as const })));
});
afterAll(async () => {
  if (ids.length)
    await db
      .delete(schema.notificationDelivery)
      .where(inArray(schema.notificationDelivery.notificationId, ids));
  await db
    .delete(schema.notification)
    .where(inArray(schema.notification.recipientAccountId, owners));
  await db
    .delete(schema.pushInstallation)
    .where(inArray(schema.pushInstallation.accountId, owners));
  await db.delete(schema.account).where(inArray(schema.account.id, owners));
  await client.end();
});

test("같은 microsecond 시각의 cursor 페이지에서 중복·누락 없이 조회한다", async () => {
  const rows = await db
    .insert(schema.notification)
    .values(
      Array.from({ length: 3 }, () => ({
        recipientAccountId: owners[0]!,
        type: "WAVEFORM_SUCCEEDED" as const,
        resourceType: "WAVEFORM_JOB" as const,
        resourceId: createEntityId(),
        eventKey: createEntityId(),
        createdAt: "2099-01-01T00:00:00.123456Z",
      })),
    )
    .returning();
  ids.push(...rows.map((row) => row.id));
  let cursor: string | undefined;
  const found: string[] = [];
  do {
    const page = await listNotifications(ctx(), { limit: 1, cursor });
    expect(page.unreadCount).toBe(3);
    found.push(...page.items.map((row) => row.id));
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  expect(found).toEqual(
    rows
      .map((row) => row.id)
      .sort()
      .reverse(),
  );
});

test("타 계정 단건·읽음·cursor와 비관리자의 접근을 격리한다", async () => {
  for (const operation of [getNotification, readNotification])
    await expect(operation(ctx(owners[1]), ids[0]!)).rejects.toMatchObject({
      code: "NOTIFICATION_NOT_FOUND",
    });
  expect(await listNotifications(ctx(owners[1]), { limit: 20, cursor: ids[0] })).toMatchObject({
    items: [],
    unreadCount: 0,
  });
  await expect(listNotifications(ctx(owners[0], "USER"), { limit: 20 })).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await expect(
    listNotifications(
      { user: null, ability: buildAbility({ accountId: null, role: null }) },
      { limit: 20 },
    ),
  ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
});

test("조회는 읽음으로 바뀌지 않고 개별 읽음은 멱등이며 모두 읽음 뒤 새 알림은 미읽음이다", async () => {
  expect((await getNotification(ctx(), ids[0]!)).readAt).toBeNull();
  const first = await readNotification(ctx(), ids[0]!);
  expect(first.readAt).not.toBeNull();
  expect((await readNotification(ctx(), ids[0]!)).readAt).toBe(first.readAt);
  await readAllNotifications(ctx());
  expect((await listNotifications(ctx(), { limit: 20 })).unreadCount).toBe(0);
  const jobId = createEntityId();
  await Promise.all(
    Array.from({ length: 3 }, () =>
      db.transaction((tx) =>
        recordWaveformNotification(tx, { accountId: owners[0]!, jobId, type: "WAVEFORM_FAILED" }),
      ),
    ),
  );
  const [created] = await db
    .select()
    .from(schema.notification)
    .where(eq(schema.notification.eventKey, jobId));
  ids.push(created!.id);
  expect((await listNotifications(ctx(), { limit: 20 })).unreadCount).toBe(1);
});
