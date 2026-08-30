import "server-only";

import { type EmailDeliveryResult, sendEmail } from "./oci-email-delivery";

export class SignupEmailSuppressedError extends Error {
  constructor() {
    super("signup verification recipient is suppressed");
    this.name = "SignupEmailSuppressedError";
  }
}

export async function sendSignupVerificationEmail(
  to: string,
  otp: string,
): Promise<EmailDeliveryResult> {
  const result = await sendEmail({
    to,
    subject: "이메일 인증 코드",
    text: `회원가입 이메일 인증 코드: ${otp}\n이 코드는 5분 동안 유효합니다.`,
    html: `<p>회원가입 이메일 인증 코드</p><p><strong>${otp}</strong></p><p>이 코드는 5분 동안 유효합니다.</p>`,
  });
  if (result.suppressedRecipients.includes(to.trim().toLowerCase())) {
    throw new SignupEmailSuppressedError();
  }
  return result;
}
