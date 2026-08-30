import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { completeSignup } from "@/server/services/signup-service";

import { completeSignupResponseSchema, completeSignupSchema } from "@/shared/contracts/signup";

export async function POST(request: Request) {
  try {
    const input = completeSignupSchema.parse(await request.json());
    const result = await completeSignup(input.challengeId, input.password, input.nickname);
    return jsonResponse(completeSignupResponseSchema, result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
