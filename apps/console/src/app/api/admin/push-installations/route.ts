import {
  pushInstallationInputSchema,
  pushInstallationSchema,
} from "@oioi-bwg/contracts/notification";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { registerPushInstallation } from "@oioi-bwg/server/services/push-installation-service";
import { cookies } from "next/headers";

import { hasConsoleMfaProof } from "@/server/auth/console-session";
import { jsonResponse, parseJsonRequest } from "@/server/http/api-response";
import { notificationRoute } from "@/server/http/notification-route";
import { PUSH_INSTALLATION_COOKIE } from "@/server/notifications/push-cookie";

import { getConsoleOrigin } from "@/shared/config/console-runtime";

import { auth } from "@/auth";

export async function PUT(request: Request) {
  return notificationRoute(request, "/api/admin/push-installations", async (ctx) => {
    if (process.env.CONSOLE_PUSH_ENABLED !== "true") throw new AppError("FORBIDDEN");
    const session = await auth();
    if (!hasConsoleMfaProof(session?.user) || session?.user?.id !== ctx.user?.id)
      throw new AppError("UNAUTHENTICATED");
    const input = await parseJsonRequest(request, pushInstallationInputSchema);
    const result = await registerPushInstallation(ctx, input.fid, {
      mfaVersion: session.user.mfaVersion,
      expiresAt: session.expires,
    });
    (await cookies()).set(PUSH_INSTALLATION_COOKIE, result.id, {
      httpOnly: true,
      secure: getConsoleOrigin().startsWith("https:"),
      sameSite: "lax",
      path: "/",
      expires: new Date(session.expires),
    });
    return jsonResponse(pushInstallationSchema, result, {
      headers: { "Cache-Control": "no-store" },
    });
  });
}
