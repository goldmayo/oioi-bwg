import "server-only";

import argon2 from "argon2";

import { getDatabase } from "../db";
import { findPasswordCredentialByEmail } from "../repositories/auth-repository";

const DUMMY_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXktc2FsdC0xNi1ieXRlcw$7WbZq0N8pR0R8m5y8KjW1D3XfOQ0b3q4uVf7M4Y2m9Q";

export interface AuthIdentity {
  id: string;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

/** Credentials를 검증하고 Auth.js session에 넣을 최소 Account identity를 반환한다. */
export async function authenticateCredentials(email: string, password: string) {
  const credential = await findPasswordCredentialByEmail(getDatabase(), normalizeEmail(email));
  const passwordHash = credential?.passwordHash ?? DUMMY_PASSWORD_HASH;
  const passwordMatches = await argon2.verify(passwordHash, password);
  const isArgon2idHash = passwordHash.startsWith("$argon2id$");

  if (
    !credential ||
    !isArgon2idHash ||
    !passwordMatches ||
    credential.account.status !== "ACTIVE"
  ) {
    return null;
  }

  return { id: credential.account.id.toString() } satisfies AuthIdentity;
}
