import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import {
  findChallengeById,
  findLatestChallengeForUpdate,
  incrementFailedAttempts,
  incrementRateLimit,
  insertChallenge,
  invalidatePendingChallenges,
  markChallengeVerified,
} from "../repositories/email-verification-repository";

const OTP_TTL_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const EMAIL_RATE_LIMIT = 5;
const IP_RATE_LIMIT = 20;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function hashOtp(otp: string) {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is required");
  return createHmac("sha256", secret).update(otp).digest("hex");
}

function createOtp() {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

function matchesOtp(otp: string, expectedHash: string) {
  const actual = Buffer.from(hashOtp(otp), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function windowStart(now: Date) {
  return new Date(Math.floor(now.getTime() / RATE_LIMIT_WINDOW_MS) * RATE_LIMIT_WINDOW_MS);
}

export async function requestOtp(emailInput: string, ipAddress: string) {
  const email = normalizeEmail(emailInput);
  if (!email || !ipAddress) throw new AppError("OTP_INVALID");

  const now = new Date();
  const nowIso = now.toISOString();
  const otp = createOtp();
  const result = await getDatabase().transaction(async (tx) => {
    const previous = await findLatestChallengeForUpdate(tx, email);
    if (previous && now.getTime() - new Date(previous.lastSentAt).getTime() < RESEND_COOLDOWN_MS) {
      throw new AppError("OTP_COOLDOWN");
    }

    const window = windowStart(now).toISOString();
    const [emailCount] = await incrementRateLimit(tx, "EMAIL", email, window);
    const [ipCount] = await incrementRateLimit(tx, "IP", ipAddress, window);
    if ((emailCount?.requestCount ?? 0) > EMAIL_RATE_LIMIT) throw new AppError("OTP_RATE_LIMITED");
    if ((ipCount?.requestCount ?? 0) > IP_RATE_LIMIT) throw new AppError("OTP_RATE_LIMITED");

    await invalidatePendingChallenges(tx, email, nowIso);
    const [challenge] = await insertChallenge(tx, {
      email,
      otpHash: hashOtp(otp),
      status: "PENDING",
      ipAddress,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
      lastSentAt: nowIso,
    });
    return challenge;
  });

  if (!result) throw new Error("OTP challenge was not created");
  // OCI/application email 함수가 소비할 내부 값이다. Route Handler 응답으로 전달하지 않는다.
  return { challengeId: result.id, otp };
}

export async function verifyOtp(challengeId: string, otp: string) {
  const database = getDatabase();
  const now = new Date();
  const challenge = await findChallengeById(database, challengeId);

  if (!challenge || challenge.status !== "PENDING") throw new AppError("OTP_INVALID");
  if (new Date(challenge.expiresAt) <= now) throw new AppError("OTP_EXPIRED");
  if (challenge.failedAttempts >= 5) throw new AppError("OTP_ATTEMPTS_EXCEEDED");

  if (!matchesOtp(otp, challenge.otpHash)) {
    const [updated] = await incrementFailedAttempts(database, challengeId, now.toISOString());
    if ((updated?.failedAttempts ?? 5) >= 5) throw new AppError("OTP_ATTEMPTS_EXCEEDED");
    throw new AppError("OTP_INVALID");
  }

  const [verified] = await markChallengeVerified(database, challengeId, now.toISOString());
  if (!verified) throw new AppError("OTP_INVALID");
  return { challengeId };
}
