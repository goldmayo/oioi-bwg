import {
  adminCheerGuideDraftResultSchema,
  adminCheerGuideEditorSchema,
  adminCheerGuideIdParamsSchema,
  saveAdminCheerGuideDraftSchema,
} from "@oioi-bwg/contracts/cheer-guide";
import {
  getAdminCheerGuideEditor,
  saveAdminCheerGuideDraft,
} from "@oioi-bwg/server/services/cheer-guide-draft-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

type Context = { params: Promise<{ id: string }> };
const route = "/api/admin/cheer-guides/[id]/draft";
export async function GET(request: Request, context: Context) {
  let authorization: RequestAuthorization | undefined;
  try {
    const { id } = adminCheerGuideIdParamsSchema.parse(await context.params);
    const data = await getAdminCheerGuideEditor(
      (authorization = await getRequestAuthorization()).context,
      id,
    );
    return jsonResponse(adminCheerGuideEditorSchema, data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return toErrorResponse(error, {
      route,
      ...readRequestObservation(request.headers, route),
      authorization,
    });
  }
}
export async function PATCH(request: Request, context: Context) {
  let authorization: RequestAuthorization | undefined;
  try {
    const { id } = adminCheerGuideIdParamsSchema.parse(await context.params);
    const input = await parseJsonRequest(request, saveAdminCheerGuideDraftSchema);
    const data = await saveAdminCheerGuideDraft(
      (authorization = await getRequestAuthorization()).context,
      id,
      input,
    );
    return jsonResponse(adminCheerGuideDraftResultSchema, data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return toErrorResponse(error, {
      route,
      ...readRequestObservation(request.headers, route),
      authorization,
    });
  }
}
