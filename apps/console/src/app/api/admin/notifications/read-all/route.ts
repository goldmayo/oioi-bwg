import { readAllNotifications } from "@oioi-bwg/server/services/notification-service";

import { notificationRoute } from "@/server/http/notification-route";
export async function POST(request: Request) {
  return notificationRoute(request, "/api/admin/notifications/read-all", async (ctx) => {
    await readAllNotifications(ctx);
    return new Response(null, { status: 204 });
  });
}
