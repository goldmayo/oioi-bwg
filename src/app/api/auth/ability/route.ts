import { getRequestContext } from "@/server/auth/request-context";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";

import { serializedAbilityResponseSchema } from "@/shared/contracts/authorization";

export async function GET() {
  try {
    const context = await getRequestContext();
    return jsonResponse(serializedAbilityResponseSchema, { rules: context.ability.rules });
  } catch (error) {
    return toErrorResponse(error);
  }
}
