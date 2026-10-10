import "server-only";

import { AdminMfaCryptoError, parseAdminMfaKey } from "@oioi-bwg/server/auth/admin-mfa-crypto";
import { authenticateConsoleMfa } from "@oioi-bwg/server/services/console-mfa-service";

/** runtime key를 명시적으로 전달하며 password-only identity는 발급하지 않는다. */
export function getConsoleMfaKey() {
  const encoded = process.env.CONSOLE_MFA_ENCRYPTION_KEY ?? "";
  if (encoded === process.env.CONSOLE_AUTH_SECRET || encoded === process.env.AUTH_SECRET)
    throw new AdminMfaCryptoError();
  return parseAdminMfaKey(encoded);
}

export async function authenticateConsole(email: string, password: string, otp: string) {
  return authenticateConsoleMfa(email, password, otp, getConsoleMfaKey());
}
