import { adminCheerGuideIdParamsSchema } from "@oioi-bwg/contracts/cheer-guide";
import { deleteEmptyCheerGuide } from "@oioi-bwg/server/services/cheer-guide-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { toErrorResponse } from "@/server/http/api-response";
import { assertConsoleOrigin } from "@/server/http/console-origin";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  let authorization: RequestAuthorization | undefined;
  try {
    assertConsoleOrigin(request.headers);
    const { id } = adminCheerGuideIdParamsSchema.parse(await context.params);
    await deleteEmptyCheerGuide((authorization = await getRequestAuthorization()).context, id);
    return new Response(null, { status: 204 });
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/admin/cheer-guides/[id]",
      ...readRequestObservation(request.headers, "/api/admin/cheer-guides/[id]"),
      authorization,
    });
  }
}
