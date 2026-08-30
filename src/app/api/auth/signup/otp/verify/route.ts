import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import { verifyOtp } from "@/server/services/email-verification-service";

import { verifySignupOtpResponseSchema, verifySignupOtpSchema } from "@/shared/contracts/signup";

export async function POST(request: Request) {
  try {
    const input = verifySignupOtpSchema.parse(await request.json());
    const result = await verifyOtp(input.challengeId, input.otp);
    return jsonResponse(verifySignupOtpResponseSchema, { ...result, verified: true });
  } catch (error) {
    return toErrorResponse(error);
  }
}
