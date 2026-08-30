import "server-only";

import argon2 from "argon2";

import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import {
  insertAccount,
  insertPasswordCredential,
  insertProfile,
} from "../repositories/auth-repository";
import { consumeVerifiedChallenge } from "../repositories/email-verification-repository";

/** VERIFIED challenge를 소비하고 USER Account/Profile/PasswordCredential을 원자적으로 생성한다. */
export async function completeSignup(challengeId: string, password: string, nickname: string) {
  const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
  const normalizedNickname = nickname.trim();
  const now = new Date().toISOString();

  try {
    const accountId = await getDatabase().transaction(async (tx) => {
      const [challenge] = await consumeVerifiedChallenge(tx, challengeId, now);
      if (!challenge) throw new AppError("OTP_NOT_VERIFIED");

      const [account] = await insertAccount(tx);
      if (!account) throw new Error("Account was not created");
      await insertProfile(tx, account.id, normalizedNickname);
      await insertPasswordCredential(tx, {
        accountId: account.id,
        email: challenge.email,
        passwordHash,
        emailVerifiedAt: now,
        passwordChangedAt: now,
      });
      return account.id;
    });
    return { accountId: accountId.toString() };
  } catch (error) {
    if (error instanceof Error && error.message.includes("password_credential_email_key")) {
      throw new AppError("EMAIL_ALREADY_REGISTERED");
    }
    if (error instanceof Error && error.message.includes("profile_nickname_key")) {
      throw new AppError("NICKNAME_ALREADY_REGISTERED");
    }
    throw error;
  }
}
