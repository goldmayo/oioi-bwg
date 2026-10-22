import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

export async function GET(request: Request) {
  let authorization: RequestAuthorization | undefined;
  try {
    const context = (authorization = await getRequestAuthorization()).context;
    return jsonResponse(serializedAbilityResponseSchema, { rules: context.ability.rules });
  } catch (error) {
    return toErrorResponse(error, {
      route: "/api/auth/ability",
      ...readRequestObservation(request.headers, "/api/auth/ability"),
      authorization,
    });
  }
}
