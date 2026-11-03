import {
  adminCheerGuideListSchema,
  adminCheerGuideMutationResultSchema,
  createAdminCheerGuideSchema,
} from "@oioi-bwg/contracts/cheer-guide";
import {
  createAdminCheerGuide,
  listAdminCheerGuides,
} from "@oioi-bwg/server/services/cheer-guide-service";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

export async function GET(request: Request) {
  let authorization: RequestAuthorization | undefined;
  try {
    const data = await listAdminCheerGuides(
      (authorization = await getRequestAuthorization()).context,
    );
    return jsonResponse(adminCheerGuideListSchema, data, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/admin/cheer-guides",
      ...readRequestObservation(request.headers, "/api/admin/cheer-guides"),
      authorization,
    });
  }
}

export async function POST(request: Request) {
  let authorization: RequestAuthorization | undefined;
  try {
    const input = await parseJsonRequest(request, createAdminCheerGuideSchema);
    const guide = await createAdminCheerGuide(
      (authorization = await getRequestAuthorization()).context,
      input,
    );
    return jsonResponse(adminCheerGuideMutationResultSchema, guide, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/admin/cheer-guides",
      ...readRequestObservation(request.headers, "/api/admin/cheer-guides"),
      authorization,
    });
  }
}
