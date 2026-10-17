import "server-only";

import { type EmailDeliveryResult, sendEmail } from "./oci-email-delivery";
import { createSignupVerificationEmail } from "./templates/signup-verification-email";

export class SignupEmailSuppressedError extends Error {
  constructor() {
    super("signup verification recipient is suppressed");
    this.name = "SignupEmailSuppressedError";
  }
}

/** 회원가입 OTP를 이메일 본문으로 구성해 발송한다. */
export async function sendSignupVerificationEmail(
  to: string,
  otp: string,
): Promise<EmailDeliveryResult> {
  const template = createSignupVerificationEmail(otp);
  const result = await sendEmail({
    to,
    ...template,
  });
  if (result.suppressedRecipients.includes(to.trim().toLowerCase())) {
    throw new SignupEmailSuppressedError();
  }
  return result;
}
