import { requestSignupOtpSchema, signupOtpResponseSchema } from "@oioi-bwg/contracts/signup";
import { requestOtp } from "@oioi-bwg/server/services/email-verification-service";
import { headers } from "next/headers";

import { jsonResponse, parseJsonRequest, toErrorResponse } from "@/server/http/api-response";

function requestIp(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || "0.0.0.0";
}

export async function POST(request: Request) {
  try {
    const input = await parseJsonRequest(request, requestSignupOtpSchema);
    const requestHeaders = await headers();
    const ipAddress = requestIp(
      requestHeaders.get("x-forwarded-for") ?? requestHeaders.get("x-real-ip"),
    );
    const { challengeId } = await requestOtp(input.email, ipAddress);
    return jsonResponse(signupOtpResponseSchema, { challengeId }, { status: 201 });
  } catch (error) {
    return toErrorResponse(error);
  }
}
