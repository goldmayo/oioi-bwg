import {
  notificationHistoryInputSchema,
  notificationHistorySchema,
} from "@oioi-bwg/contracts/notification";
import { listNotificationHistory } from "@oioi-bwg/server/services/notification-service";

import { jsonResponse } from "@/server/http/api-response";
import { notificationRoute } from "@/server/http/notification-route";

export async function GET(request: Request) {
  return notificationRoute(request, "/api/admin/notifications/history", async (ctx) => {
    const input = notificationHistoryInputSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return jsonResponse(notificationHistorySchema, await listNotificationHistory(ctx, input), {
      headers: { "Cache-Control": "no-store" },
    });
  });
}
