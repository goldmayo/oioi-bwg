import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";

import { getRequestAuthorization, type RequestAuthorization } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";

export async function GET() {
  let authorization: RequestAuthorization | undefined;
  try {
    const context = (authorization = await getRequestAuthorization()).context;
    return jsonResponse(serializedAbilityResponseSchema, { rules: context.ability.rules });
  } catch (error) {
    return toErrorResponse(error, { route: "/api/auth/ability", authorization });
  }
}
