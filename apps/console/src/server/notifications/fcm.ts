import "server-only";

import {
  PushDeliveryError,
  type PushTarget,
} from "@oioi-bwg/server/services/notification-delivery-service";
import { GoogleAuth } from "google-auth-library";

import { getConsoleOrigin } from "@/shared/config/console-runtime";

import { getPushConfig, getPushCredentials } from "./config";

export function createFcmSender() {
  const config = getPushConfig();
  if (!config) throw new Error("Console push is disabled");
  const auth = new GoogleAuth({
    credentials: getPushCredentials(config.projectId),
    scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    clientOptions: { transporterOptions: { timeout: 10_000, retry: false } },
  });
  const origin = getConsoleOrigin();
  return async (target: PushTarget) => {
    let token: string | null | undefined;
    try {
      token = await auth.getAccessToken();
    } catch {
      throw new PushDeliveryError("AUTHENTICATION");
    }
    if (!token) throw new PushDeliveryError("AUTHENTICATION");
    const ttl = Math.floor((new Date(target.expiresAt).getTime() - Date.now()) / 1000);
    if (ttl <= 0) throw new PushDeliveryError("EXPIRED");
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
      {
        method: "POST",
        signal: AbortSignal.timeout(10_000),
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            fid: target.fid,
            notification: { title: "작업 알림", body: "작업 결과를 확인해 주세요." },
            data: { notificationId: target.notificationId },
            webpush: {
              headers: { TTL: String(Math.min(ttl, 86400)) },
              notification: {
                tag: target.notificationId,
                renotify: false,
                icon: "/notification-icon.png",
              },
              fcm_options: {
                link: `${origin}/admin/notifications?notificationId=${target.notificationId}`,
              },
            },
          },
        }),
      },
    );
    if (response.ok) {
      await response.body?.cancel();
      return;
    }
    const body: unknown = await response.json().catch(() => null);
    const details =
      typeof body === "object" && body !== null && "error" in body
        ? (body as { error?: { details?: { errorCode?: string }[] } }).error?.details
        : undefined;
    if (Array.isArray(details) && details.some((item) => item?.errorCode === "UNREGISTERED"))
      throw new PushDeliveryError("UNREGISTERED");
    const header = response.headers.get("retry-after");
    const delay = header
      ? /^\d+$/.test(header)
        ? Number(header) * 1000
        : Math.max(0, Date.parse(header) - Date.now())
      : 0;
    if (response.status === 429)
      throw new PushDeliveryError(
        "QUOTA",
        Number.isFinite(delay) ? Math.max(delay, 60_000) : 60_000,
      );
    if ([401, 403].includes(response.status))
      throw new PushDeliveryError("AUTHENTICATION", Number.isFinite(delay) ? delay : 0);
    throw new PushDeliveryError(
      response.status >= 500 ? "NETWORK" : "INVALID_MESSAGE",
      Number.isFinite(delay) ? delay : 0,
    );
  };
}
