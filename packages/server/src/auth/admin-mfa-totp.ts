import "server-only";

import { generateSecret, verifySync } from "otplib";

export class AdminMfaTotpError extends Error {
  constructor() {
    super("Console MFA TOTP 처리 실패");
    this.name = "AdminMfaTotpError";
  }
}

export function generateAdminMfaSecret(): string {
  try {
    return generateSecret({ length: 20 });
  } catch {
    throw new AdminMfaTotpError();
  }
}

// epoch는 서버가 획득한 Unix seconds다. 반환 step의 DB 원자 소모는 service가 담당한다.
export function verifyAdminMfaTotp(
  secret: string,
  token: string,
  epoch: number,
  lastUsedStep?: number,
): number | null {
  if (typeof token !== "string" || token.length !== 6 || !/^\d{6}$/.test(token)) return null;
  try {
    const result = verifySync({
      strategy: "totp",
      secret,
      token,
      algorithm: "sha1",
      digits: 6,
      period: 30,
      epoch,
      epochTolerance: 30,
      afterTimeStep: lastUsedStep,
    });
    return result.valid && "timeStep" in result ? result.timeStep : null;
  } catch {
    throw new AdminMfaTotpError();
  }
}
