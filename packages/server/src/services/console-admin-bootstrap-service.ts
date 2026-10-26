import "server-only";

import { entityIdSchema } from "@oioi-bwg/contracts/entity-id";
import { completeSignupSchema, requestSignupOtpSchema } from "@oioi-bwg/contracts/signup";
import argon2 from "argon2";

import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import { lockConsoleAuthenticationFacts } from "../repositories/admin-mfa-repository";
import { insertPasswordCredential } from "../repositories/auth-repository";

// Operator-only. Re-registers credentials for an existing reset ADMIN; never creates/promotes users.
export async function bootstrapConsoleAdminCredential(
  accountId: string,
  expectedMfaVersion: number | null,
  email: string,
  password: string,
) {
  const id = entityIdSchema.parse(accountId);
  const normalizedEmail = requestSignupOtpSchema.parse({ email }).email.toLowerCase();
  const parsedPassword = completeSignupSchema.shape.password.parse(password);
  const passwordHash = await argon2.hash(parsedPassword, { type: argon2.argon2id });
  const now = new Date().toISOString();
  return getDatabase().transaction(async (tx) => {
    const current = await lockConsoleAuthenticationFacts(tx, id);
    if (
      current.account?.role !== "ADMIN" ||
      current.account.status !== "ACTIVE" ||
      current.credential ||
      (current.mfa?.version ?? null) !== expectedMfaVersion ||
      current.mfa?.encryptedSecret != null ||
      current.mfa?.enabledAt != null
    )
      throw new AppError("FORBIDDEN");
    await insertPasswordCredential(tx, {
      accountId: id,
      email: normalizedEmail,
      passwordHash,
      emailVerifiedAt: now,
      passwordChangedAt: now,
    });
    return { accountId: id, credentialCreated: true as const };
  });
}
