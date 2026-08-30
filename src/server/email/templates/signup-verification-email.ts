import "server-only";

export type SignupVerificationEmailTemplate = {
  subject: string;
  text: string;
  html: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character] ?? character;
  });
}

/**
 * broad email client 호환성을 위해 table layout과 inline CSS만 사용하는 회원가입 OTP 메일을 만든다.
 */
export function createSignupVerificationEmail(otp: string): SignupVerificationEmailTemplate {
  const safeOtp = escapeHtml(otp);

  return {
    subject: "[어이어이 바위게] 이메일 인증 코드",
    text: [
      "어이어이 바위게 회원가입 이메일 인증 코드",
      "",
      otp,
      "",
      "이 코드는 5분 동안 유효합니다.",
      "본인이 요청하지 않았다면 이 이메일을 무시해주세요.",
    ].join("\n"),
    html: `<!doctype html>
<html lang="ko">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>이메일 인증 코드</title>
  </head>
  <body style="margin:0; padding:0; background-color:#f4f4f5;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; border-collapse:collapse; background-color:#f4f4f5;">
      <tr>
        <td align="center" style="padding:32px 16px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; border-collapse:collapse; background-color:#ffffff;">
            <tr>
              <td style="padding:32px 32px 8px; font-family:Arial, 'Apple SD Gothic Neo', sans-serif; color:#18181b; font-size:24px; font-weight:700; line-height:32px;">
                어이어이 바위게
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 0; font-family:Arial, 'Apple SD Gothic Neo', sans-serif; color:#3f3f46; font-size:16px; line-height:24px;">
                회원가입을 완료하려면 아래 인증 코드를 입력해주세요.
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 32px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse; background-color:#18181b;">
                  <tr>
                    <td style="padding:16px 24px; font-family:Arial, 'Apple SD Gothic Neo', sans-serif; color:#ffffff; font-size:28px; font-weight:700; letter-spacing:6px; line-height:32px;">
                      ${safeOtp}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 32px; font-family:Arial, 'Apple SD Gothic Neo', sans-serif; color:#71717a; font-size:14px; line-height:21px;">
                이 코드는 5분 동안 유효합니다.<br>
                본인이 요청하지 않았다면 이 이메일을 무시해주세요.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`,
  };
}
