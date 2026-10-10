import "server-only";

import argon2 from "argon2";

import { decryptAdminMfaSecret, encryptAdminMfaSecret } from "../auth/admin-mfa-crypto";
import { generateAdminMfaSecret, verifyAdminMfaTotp } from "../auth/admin-mfa-totp";
import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import {
  consumeAdminMfaStep,
  ensurePendingAdminMfa,
  findAdminMfa,
  lockConsoleAuthenticationFacts,
} from "../repositories/admin-mfa-repository";
import { findConsolePasswordCredential } from "../repositories/auth-repository";

const DUMMY_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$ZHVtbXktc2FsdC0xNi1ieXRlcw$7WbZq0N8pR0R8m5y8KjW1D3XfOQ0b3q4uVf7M4Y2m9Q";
type Credential = NonNullable<Awaited<ReturnType<typeof findConsolePasswordCredential>>>;

async function verifyPassword(email: string, password: string) {
  const credential = await findConsolePasswordCredential(getDatabase(), email.trim().toLowerCase());
  const hash = credential?.passwordHash ?? DUMMY_HASH;
  const matches = await argon2.verify(hash, password);
  return credential &&
    matches &&
    hash.startsWith("$argon2id$") &&
    credential.account.role === "ADMIN" &&
    credential.account.status === "ACTIVE"
    ? credential
    : null;
}

function assertCurrentCredential(
  expected: Credential,
  current: Awaited<ReturnType<typeof lockConsoleAuthenticationFacts>>,
) {
  const keys = [
    "accountId",
    "email",
    "passwordHash",
    "emailVerifiedAt",
    "passwordChangedAt",
    "updatedAt",
  ] as const;
  if (
    current.account?.role !== "ADMIN" ||
    current.account.status !== "ACTIVE" ||
    !current.credential ||
    keys.some((key) => current.credential![key] !== expected[key])
  ) {
    throw new AppError("UNAUTHENTICATED");
  }
}

// 등록 허용 설정/Origin/limiter는 후속 Console adapter가 확인한다. 관리 identity를 발급하지 않는다.
export async function setupConsoleMfa(email: string, password: string, key: Uint8Array) {
  const credential = await verifyPassword(email, password);
  if (!credential) throw new AppError("UNAUTHENTICATED");
  const candidate = encryptAdminMfaSecret(credential.accountId, generateAdminMfaSecret(), key);
  const pending = await getDatabase().transaction(async (tx) => {
    assertCurrentCredential(
      credential,
      await lockConsoleAuthenticationFacts(tx, credential.accountId),
    );
    const stored = await ensurePendingAdminMfa(tx, credential.accountId, candidate);
    if (!stored?.encryptedSecret) throw new AppError("UNAUTHENTICATED");
    return stored;
  });
  return {
    secret: decryptAdminMfaSecret(credential.accountId, pending.encryptedSecret!, key),
    version: pending.version,
  };
}

async function consumeOtp(
  email: string,
  password: string,
  token: string,
  key: Uint8Array,
  expectedVersion?: number,
) {
  const credential = await verifyPassword(email, password);
  if (!credential) throw new AppError("UNAUTHENTICATED");
  const snapshot = await findAdminMfa(getDatabase(), credential.accountId);
  const confirming = expectedVersion !== undefined;
  if (
    !snapshot?.encryptedSecret ||
    (confirming
      ? snapshot.enabledAt !== null || snapshot.version !== expectedVersion
      : snapshot.enabledAt === null)
  ) {
    throw new AppError("UNAUTHENTICATED");
  }
  const secret = decryptAdminMfaSecret(credential.accountId, snapshot.encryptedSecret, key);
  const step = verifyAdminMfaTotp(
    secret,
    token,
    Math.floor(Date.now() / 1000),
    snapshot.lastUsedStep ?? undefined,
  );
  if (step === null) throw new AppError("UNAUTHENTICATED");
  const expected = { ...snapshot, encryptedSecret: snapshot.encryptedSecret };
  const confirmedAt = new Date().toISOString();
  return getDatabase().transaction(async (tx) => {
    assertCurrentCredential(
      credential,
      await lockConsoleAuthenticationFacts(tx, credential.accountId),
    );
    const rows = await consumeAdminMfaStep(tx, expected, step, confirmedAt);
    if (rows.length !== 1) throw new AppError("UNAUTHENTICATED");
    return {
      id: credential.accountId.toString(),
      mfaVerified: true as const,
      mfaVersion: rows[0]!.version,
    };
  });
}

export async function confirmConsoleMfa(
  email: string,
  password: string,
  token: string,
  version: number,
  key: Uint8Array,
) {
  if (!Number.isInteger(version) || version <= 0) throw new AppError("UNAUTHENTICATED");
  await consumeOtp(email, password, token, key, version);
}

export async function authenticateConsoleMfa(
  email: string,
  password: string,
  token: string,
  key: Uint8Array,
) {
  try {
    return await consumeOtp(email, password, token, key);
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") return null;
    throw error;
  }
}
