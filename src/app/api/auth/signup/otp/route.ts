import { headers } from "next/headers";

import { sendSignupVerificationEmail } from "@/server/email/signup-verification-email";
import { jsonResponse, toErrorResponse } from "@/server/http/api-response";
import {
  invalidateOtpAfterDeliveryFailure,
  requestOtp,
} from "@/server/services/email-verification-service";

import { requestSignupOtpSchema, signupOtpResponseSchema } from "@/shared/contracts/signup";

function requestIp(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || "0.0.0.0";
}

export async function POST(request: Request) {
  try {
    const input = requestSignupOtpSchema.parse(await request.json());
    const requestHeaders = await headers();
    const ipAddress = requestIp(
      requestHeaders.get("x-forwarded-for") ?? requestHeaders.get("x-real-ip"),
    );
    const { challengeId, otp } = await requestOtp(input.email, ipAddress);
    try {
      await sendSignupVerificationEmail(input.email, otp);
    } catch (error) {
      await invalidateOtpAfterDeliveryFailure(challengeId);
      throw error;
    }
    return jsonResponse(signupOtpResponseSchema, { challengeId });
  } catch (error) {
    return toErrorResponse(error);
  }
}
