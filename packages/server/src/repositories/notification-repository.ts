import "server-only";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import type { NotificationListInput } from "@oioi-bwg/contracts/notification";
import type { DbExecutor } from "../db";
import { notification, notificationDelivery, pushInstallation } from "../db/schema";

export function findNotifications(db: DbExecutor, accountId: string, input: NotificationListInput) {
  return db
    .select()
    .from(notification)
    .where(
      and(
        eq(notification.recipientAccountId, accountId),
        input.cursor
          ? sql`(${notification.createdAt}, ${notification.id}) < (select created_at, id from notification where id = ${input.cursor} and recipient_account_id = ${accountId})`
          : undefined,
      ),
    )
    .orderBy(desc(notification.createdAt), desc(notification.id))
    .limit(input.limit + 1);
}
export async function countUnreadNotifications(db: DbExecutor, accountId: string) {
  const [row] = await db
    .select({ count: count() })
    .from(notification)
    .where(and(eq(notification.recipientAccountId, accountId), isNull(notification.readAt)));
  return row?.count ?? 0;
}
export async function findNotification(db: DbExecutor, accountId: string, id: string) {
  const [row] = await db
    .select()
    .from(notification)
    .where(and(eq(notification.id, id), eq(notification.recipientAccountId, accountId)));
  return row;
}
export function setNotificationRead(db: DbExecutor, accountId: string, id: string) {
  return db
    .update(notification)
    .set({ readAt: sql`coalesce(${notification.readAt}, now())` })
    .where(and(eq(notification.recipientAccountId, accountId), eq(notification.id, id)))
    .returning();
}
export function setAllNotificationsRead(db: DbExecutor, accountId: string) {
  return db
    .update(notification)
    .set({ readAt: sql`now()` })
    .where(and(eq(notification.recipientAccountId, accountId), isNull(notification.readAt)));
}
export async function insertNotification(db: DbExecutor, input: typeof notification.$inferInsert) {
  const [row] = await db
    .insert(notification)
    .values(input)
    .onConflictDoNothing({
      target: [notification.recipientAccountId, notification.type, notification.eventKey],
    })
    .returning();
  return row;
}
export async function insertNotificationDeliveries(
  db: DbExecutor,
  row: typeof notification.$inferSelect,
) {
  const installations = await db
    .select()
    .from(pushInstallation)
    .where(
      and(
        eq(pushInstallation.accountId, row.recipientAccountId),
        eq(pushInstallation.enabled, true),
        sql`${pushInstallation.expiresAt} > now()`,
      ),
    );
  if (!installations.length) return;
  await db
    .insert(notificationDelivery)
    .values(
      installations.map((installation) => ({
        notificationId: row.id,
        installationId: installation.id,
        bindingVersion: installation.bindingVersion,
        expiresAt: new Date(new Date(row.createdAt).getTime() + 86400_000).toISOString(),
      })),
    )
    .onConflictDoNothing();
}
