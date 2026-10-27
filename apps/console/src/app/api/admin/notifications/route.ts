import {
  notificationListInputSchema,
  notificationListSchema,
} from "@oioi-bwg/contracts/notification";
import { listNotifications } from "@oioi-bwg/server/services/notification-service";

import { jsonResponse } from "@/server/http/api-response";
import { notificationRoute } from "@/server/http/notification-route";
export async function GET(request: Request) {
  return notificationRoute(request, "/api/admin/notifications", async (ctx) => {
    const input = notificationListInputSchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );
    return jsonResponse(notificationListSchema, await listNotifications(ctx, input), {
      headers: { "Cache-Control": "no-store" },
    });
  });
}
