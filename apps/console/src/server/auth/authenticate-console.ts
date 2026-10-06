import "server-only";

import { getDatabase } from "@oioi-bwg/server/db";
import { findAuthorizationFactsByAccountId } from "@oioi-bwg/server/repositories/auth-repository";
import { authenticateCredentials } from "@oioi-bwg/server/services/authentication-service";

/** Console의 기존 password 검증 뒤 활성 관리자만 identity로 반환한다. */
export async function authenticateConsole(email: string, password: string) {
  const identity = await authenticateCredentials(email, password);
  if (!identity) return null;
  const facts = await findAuthorizationFactsByAccountId(getDatabase(), BigInt(identity.id));
  return facts?.status === "ACTIVE" && facts.role === "ADMIN" ? identity : null;
}
