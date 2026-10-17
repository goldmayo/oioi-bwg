import { serializedAbilityResponseSchema } from "@oioi-bwg/contracts/authorization";

import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";

export async function GET() {
  try {
    const context = await getRequestContext();
    return jsonResponse(serializedAbilityResponseSchema, { rules: context.ability.rules });
  } catch (error) {
    return toErrorResponse(error);
  }
}
