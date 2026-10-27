import {
  notificationListSchema,
  notificationSchema,
  pushInstallationSchema,
} from "@oioi-bwg/contracts/notification";

import { http } from "@/shared/api/http-client";
import { parseClientResponse } from "@/shared/api/http-errors";
const base = "/api/admin/notifications";
export async function getNotifications(cursor?: string, signal?: AbortSignal) {
  const query = new URLSearchParams({ limit: "20" });
  if (cursor) query.set("cursor", cursor);
  return parseClientResponse(
    notificationListSchema,
    await http.get(`${base}?${query}`, { signal }),
  );
}
export async function getNotification(id: string, signal?: AbortSignal) {
  return parseClientResponse(notificationSchema, await http.get(`${base}/${id}`, { signal }));
}
export async function readNotification(id: string) {
  return parseClientResponse(notificationSchema, await http.patch(`${base}/${id}/read`));
}
export async function readAllNotifications() {
  await http.postVoid(`${base}/read-all`);
}
export async function registerPushInstallation(fid: string) {
  return parseClientResponse(
    pushInstallationSchema,
    await http.put("/api/admin/push-installations", { json: { fid } }),
  );
}
export async function unregisterPushInstallation(id: string) {
  await http.delete(`/api/admin/push-installations/${id}`);
}
