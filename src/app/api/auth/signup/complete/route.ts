import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";
import { completeSignup } from "@/server/services/signup-service";

import { completeSignupResponseSchema, completeSignupSchema } from "@/shared/contracts/signup";

export async function POST(request: Request) {
  try {
    const input = await parseJsonRequest(request, completeSignupSchema);
    const result = await completeSignup(input.challengeId, input.password, input.nickname);
    return jsonResponse(completeSignupResponseSchema, result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
