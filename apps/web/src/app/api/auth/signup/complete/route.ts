import { completeSignupResponseSchema, completeSignupSchema } from "@oioi-bwg/contracts/signup";
import { completeSignup } from "@oioi-bwg/server/services/signup-service";

import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

export async function POST(request: Request) {
  try {
    const input = await parseJsonRequest(request, completeSignupSchema);
    const result = await completeSignup(input.challengeId, input.password, input.nickname);
    return jsonResponse(completeSignupResponseSchema, result, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
