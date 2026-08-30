import { and, desc, eq, gt, lt, sql } from "drizzle-orm";

import type { DbExecutor } from "../db";
import {
  emailVerificationChallenge,
  emailVerificationRateLimit,
  type EmailVerificationRateLimitScope,
} from "../db/schema";

export async function findLatestChallengeForUpdate(executor: DbExecutor, email: string) {
  const [challenge] = await executor
    .select()
    .from(emailVerificationChallenge)
    .where(eq(emailVerificationChallenge.email, email))
    .orderBy(desc(emailVerificationChallenge.createdAt))
    .limit(1)
    .for("update");
  return challenge;
}

export function insertChallenge(
  executor: DbExecutor,
  data: typeof emailVerificationChallenge.$inferInsert,
) {
  return executor
    .insert(emailVerificationChallenge)
    .values(data)
    .returning({ id: emailVerificationChallenge.id });
}

export function invalidatePendingChallenges(executor: DbExecutor, email: string, now: string) {
  return executor
    .update(emailVerificationChallenge)
    .set({ status: "INVALIDATED", invalidatedAt: now })
    .where(
      and(
        eq(emailVerificationChallenge.email, email),
        eq(emailVerificationChallenge.status, "PENDING"),
      ),
    );
}

export function findChallengeById(executor: DbExecutor, id: string) {
  return executor.query.emailVerificationChallenge.findFirst({
    where: (table, { eq: equals }) => equals(table.id, id),
  });
}

export function markChallengeVerified(executor: DbExecutor, id: string, now: string) {
  return executor
    .update(emailVerificationChallenge)
    .set({ status: "VERIFIED", verifiedAt: now })
    .where(
      and(
        eq(emailVerificationChallenge.id, id),
        eq(emailVerificationChallenge.status, "PENDING"),
        gt(emailVerificationChallenge.expiresAt, now),
        lt(emailVerificationChallenge.failedAttempts, 5),
      ),
    )
    .returning({ id: emailVerificationChallenge.id });
}

export function incrementFailedAttempts(executor: DbExecutor, id: string, now: string) {
  return executor
    .update(emailVerificationChallenge)
    .set({ failedAttempts: sql`${emailVerificationChallenge.failedAttempts} + 1` })
    .where(
      and(
        eq(emailVerificationChallenge.id, id),
        eq(emailVerificationChallenge.status, "PENDING"),
        gt(emailVerificationChallenge.expiresAt, now),
        lt(emailVerificationChallenge.failedAttempts, 5),
      ),
    )
    .returning({ failedAttempts: emailVerificationChallenge.failedAttempts });
}

export function incrementRateLimit(
  executor: DbExecutor,
  scope: EmailVerificationRateLimitScope,
  key: string,
  windowStartedAt: string,
) {
  return executor
    .insert(emailVerificationRateLimit)
    .values({ scope, key, windowStartedAt, requestCount: 1 })
    .onConflictDoUpdate({
      target: [
        emailVerificationRateLimit.scope,
        emailVerificationRateLimit.key,
        emailVerificationRateLimit.windowStartedAt,
      ],
      set: {
        requestCount: sql`${emailVerificationRateLimit.requestCount} + 1`,
        updatedAt: sql`now()`,
      },
    })
    .returning({ requestCount: emailVerificationRateLimit.requestCount });
}
