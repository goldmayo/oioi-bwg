import "server-only";
import { and, eq, gt, isNotNull, sql } from "drizzle-orm";
import type { DbExecutor } from "../db";
import {
  account,
  adminMfa,
  notification,
  notificationDelivery as delivery,
  pushInstallation as installation,
} from "../db/schema";

export async function claimNotificationDelivery(db: DbExecutor, leaseToken: string) {
  const [row] = await db
    .update(delivery)
    .set({
      leaseToken,
      leaseUntil: sql`now() + interval '2 minutes'`,
      attemptCount: sql`${delivery.attemptCount} + 1`,
    })
    .where(
      sql`${delivery.id} = (select id from notification_delivery where status = 'PENDING' and next_attempt_at <= now() and (lease_until is null or lease_until <= now()) order by next_attempt_at, id for update skip locked limit 1)`,
    )
    .returning();
  return row;
}
export async function findDeliveryTarget(db: DbExecutor, id: string, leaseToken: string) {
  const [row] = await db
    .select({
      fid: installation.fid,
      notificationId: notification.id,
      installationId: installation.id,
      bindingVersion: installation.bindingVersion,
      expiresAt: delivery.expiresAt,
    })
    .from(delivery)
    .innerJoin(notification, eq(notification.id, delivery.notificationId))
    .innerJoin(
      installation,
      and(
        eq(installation.id, delivery.installationId),
        eq(installation.bindingVersion, delivery.bindingVersion),
        eq(installation.accountId, notification.recipientAccountId),
      ),
    )
    .innerJoin(account, eq(account.id, installation.accountId))
    .innerJoin(
      adminMfa,
      and(eq(adminMfa.accountId, account.id), eq(adminMfa.version, installation.mfaVersion)),
    )
    .where(
      and(
        eq(delivery.id, id),
        eq(delivery.leaseToken, leaseToken),
        eq(delivery.status, "PENDING"),
        gt(delivery.expiresAt, sql`now()`),
        gt(installation.expiresAt, sql`now()`),
        eq(installation.enabled, true),
        eq(account.status, "ACTIVE"),
        eq(account.role, "ADMIN"),
        isNotNull(adminMfa.enabledAt),
      ),
    );
  return row;
}
export function finishNotificationDelivery(
  db: DbExecutor,
  id: string,
  leaseToken: string,
  update: {
    status: "PENDING" | "ACCEPTED" | "DISCARDED";
    lastErrorCode: string | null;
    nextAttemptAt?: string;
    acceptedAt?: string;
  },
) {
  return db
    .update(delivery)
    .set({ ...update, leaseToken: null, leaseUntil: null })
    .where(
      and(eq(delivery.id, id), eq(delivery.leaseToken, leaseToken), eq(delivery.status, "PENDING")),
    );
}
export function discardPushRegistration(db: DbExecutor, id: string, bindingVersion: number) {
  return db
    .update(installation)
    .set({ enabled: false, bindingVersion: sql`${installation.bindingVersion} + 1` })
    .where(and(eq(installation.id, id), eq(installation.bindingVersion, bindingVersion)));
}
