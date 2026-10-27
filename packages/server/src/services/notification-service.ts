import "server-only";
import type {
  Notification,
  NotificationListInput,
  NotificationType,
} from "@oioi-bwg/contracts/notification";
import { requireUser, type RequestContext } from "../auth/request-context";
import { getDatabase, type Transaction } from "../db";
import { AppError } from "../errors/app-error";
import {
  countUnreadNotifications,
  findNotification,
  findNotifications,
  insertNotification,
  insertNotificationDeliveries,
  setNotificationRead,
  setAllNotificationsRead,
} from "../repositories/notification-repository";

type Row = NonNullable<Awaited<ReturnType<typeof findNotification>>>;
function owner(ctx: RequestContext) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  return ctx.user.id;
}
function project(row: Row): Notification {
  return {
    id: row.id,
    type: row.type,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    createdAt: new Date(row.createdAt).toISOString(),
    readAt: row.readAt ? new Date(row.readAt).toISOString() : null,
    title:
      row.type === "WAVEFORM_SUCCEEDED" ? "파형 생성이 완료됐어요" : "파형을 생성하지 못했어요",
    href: `/admin/waveform-jobs/${row.resourceId}`,
  };
}
export async function listNotifications(ctx: RequestContext, input: NotificationListInput) {
  const accountId = owner(ctx);
  const [rows, unreadCount] = await Promise.all([
    findNotifications(getDatabase(), accountId, input),
    countUnreadNotifications(getDatabase(), accountId),
  ]);
  const items = rows.slice(0, input.limit);
  return {
    items: items.map(project),
    nextCursor: rows.length > input.limit ? items.at(-1)!.id : null,
    unreadCount,
  };
}
export async function getNotification(ctx: RequestContext, id: string) {
  const row = await findNotification(getDatabase(), owner(ctx), id);
  if (!row) throw new AppError("NOTIFICATION_NOT_FOUND");
  return project(row);
}
export async function readNotification(ctx: RequestContext, id: string) {
  const [row] = await setNotificationRead(getDatabase(), owner(ctx), id);
  if (!row) throw new AppError("NOTIFICATION_NOT_FOUND");
  return project(row);
}
export async function readAllNotifications(ctx: RequestContext) {
  await setAllNotificationsRead(getDatabase(), owner(ctx));
}
/** 호출자의 결과 transaction에서 저장하며 commit 이후 발송은 앱 adapter가 담당한다. */
export async function recordWaveformNotification(
  tx: Transaction,
  input: { accountId: string; jobId: string; type: NotificationType },
) {
  const row = await insertNotification(tx, {
    recipientAccountId: input.accountId,
    type: input.type,
    resourceType: "WAVEFORM_JOB",
    resourceId: input.jobId,
    eventKey: input.jobId,
  });
  if (row) await insertNotificationDeliveries(tx, row);
}
