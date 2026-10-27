import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { unregisterPushInstallation } from "@oioi-bwg/server/services/push-installation-service";
import { cookies } from "next/headers";

import { notificationRoute } from "@/server/http/notification-route";
import { PUSH_INSTALLATION_COOKIE } from "@/server/notifications/push-cookie";
export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  return notificationRoute(request, "/api/admin/push-installations/[id]", async (ctx) => {
    const id = entityIdSchema.parse((await context.params).id);
    await unregisterPushInstallation(ctx, id);
    const store = await cookies();
    if (store.get(PUSH_INSTALLATION_COOKIE)?.value === id) store.delete(PUSH_INSTALLATION_COOKIE);
    return new Response(null, { status: 204 });
  });
}
