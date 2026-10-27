import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { notificationSchema } from "@oioi-bwg/contracts/notification";
import { getNotification } from "@oioi-bwg/server/services/notification-service";

import { jsonResponse } from "@/server/http/api-response";
import { notificationRoute } from "@/server/http/notification-route";
export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  return notificationRoute(request, "/api/admin/notifications/[id]", async (ctx) =>
    jsonResponse(
      notificationSchema,
      await getNotification(ctx, entityIdSchema.parse((await context.params).id)),
      { headers: { "Cache-Control": "no-store" } },
    ),
  );
}
