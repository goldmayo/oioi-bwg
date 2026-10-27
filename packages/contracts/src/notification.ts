import { z } from "zod";

import { entityIdSchema } from "./entity-id";

export const notificationTypeSchema = z.enum(["WAVEFORM_SUCCEEDED", "WAVEFORM_FAILED"]);
export const notificationCursorSchema = entityIdSchema;
export const notificationListInputSchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(20),
  cursor: notificationCursorSchema.optional(),
});
export const notificationSchema = z.object({
  id: entityIdSchema,
  type: notificationTypeSchema,
  resourceType: z.literal("WAVEFORM_JOB"),
  resourceId: entityIdSchema,
  createdAt: z.iso.datetime({ offset: true }),
  readAt: z.iso.datetime({ offset: true }).nullable(),
  title: z.string(),
  href: z.string().startsWith("/admin/"),
});
export const notificationListSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
  unreadCount: z.number().int().nonnegative(),
});
export const pushInstallationInputSchema = z.object({
  fid: z.string().regex(/^[A-Za-z0-9_-]{16,256}$/),
});
export const pushInstallationSchema = z.object({ id: entityIdSchema });
export const notificationPushSchema = z.object({ notificationId: entityIdSchema });

export type Notification = z.infer<typeof notificationSchema>;
export type NotificationType = z.infer<typeof notificationTypeSchema>;
export type NotificationListInput = z.infer<typeof notificationListInputSchema>;
export type NotificationCursor = z.infer<typeof notificationCursorSchema>;
export type NotificationList = z.infer<typeof notificationListSchema>;
