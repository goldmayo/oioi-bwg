import "server-only";

import { sendEmail } from "./oci-email-delivery";

export function sendSignupVerificationEmail(to: string, otp: string) {
  return sendEmail({
    to,
    subject: "이메일 인증 코드",
    text: `회원가입 이메일 인증 코드: ${otp}\n이 코드는 5분 동안 유효합니다.`,
    html: `<p>회원가입 이메일 인증 코드</p><p><strong>${otp}</strong></p><p>이 코드는 5분 동안 유효합니다.</p>`,
  });
}
