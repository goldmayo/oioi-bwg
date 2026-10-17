import { verifySignupOtpResponseSchema, verifySignupOtpSchema } from "@oioi-bwg/contracts/signup";
import { verifyOtp } from "@oioi-bwg/server/services/email-verification-service";

import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

export async function POST(request: Request) {
  try {
    const input = await parseJsonRequest(request, verifySignupOtpSchema);
    const result = await verifyOtp(input.challengeId, input.otp);
    return jsonResponse(verifySignupOtpResponseSchema, { ...result, verified: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
