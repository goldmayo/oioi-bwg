import "server-only";
import { and, eq, gt, isNotNull, isNull, lt, or } from "drizzle-orm";
import { isPostgresUniqueViolation } from "../db/postgres-error";
import type { DbExecutor } from "../db";
import { operatorSession } from "../db/schema";

export class OperatorSessionConflictError extends Error {}

export async function insertOperatorSession(
  executor: DbExecutor,
  input: {
    deviceHash: string;
    userCodeHash: string;
    createdAt: string;
    expiresAt: string;
  },
) {
  try {
    const [row] = await executor.insert(operatorSession).values(input).returning();
    return row!;
  } catch (error) {
    if (
      isPostgresUniqueViolation(error, "operator_session_user_code_hash_key") ||
      isPostgresUniqueViolation(error, "operator_session_device_hash_key")
    ) {
      throw new OperatorSessionConflictError("OPERATOR_SESSION_CONFLICT");
    }
    throw error;
  }
}
export async function findOperatorSessionByDevice(executor: DbExecutor, deviceHash: string) {
  const [row] = await executor
    .select()
    .from(operatorSession)
    .where(eq(operatorSession.deviceHash, deviceHash));
  return row;
}
/** 같은 user code의 승인자를 나중에 교체하지 않는다. */
export async function approveOperatorSession(
  executor: DbExecutor,
  userCodeHash: string,
  proof: { accountId: string; mfaVersion: number },
  now: string,
) {
  const [row] = await executor
    .update(operatorSession)
    .set({ ...proof, approvedAt: now })
    .where(
      and(
        eq(operatorSession.userCodeHash, userCodeHash),
        isNull(operatorSession.approvedAt),
        gt(operatorSession.expiresAt, now),
      ),
    )
    .returning();
  return row;
}
/** 조건부 단일 SQL로 한 요청만 token 교환을 소유한다. */
export async function exchangeOperatorSession(
  executor: DbExecutor,
  deviceHash: string,
  token: { tokenHash: string; tokenExpiresAt: string },
  now: string,
) {
  const [row] = await executor
    .update(operatorSession)
    .set({ ...token, exchangedAt: now })
    .where(
      and(
        eq(operatorSession.deviceHash, deviceHash),
        isNotNull(operatorSession.approvedAt),
        isNull(operatorSession.exchangedAt),
        isNull(operatorSession.revokedAt),
        gt(operatorSession.expiresAt, now),
      ),
    )
    .returning();
  return row;
}
export async function findOperatorSessionByToken(
  executor: DbExecutor,
  tokenHash: string,
  now: string,
) {
  const [row] = await executor
    .select()
    .from(operatorSession)
    .where(
      and(
        eq(operatorSession.tokenHash, tokenHash),
        isNull(operatorSession.revokedAt),
        gt(operatorSession.tokenExpiresAt, now),
      ),
    );
  return row;
}
export async function revokeOperatorSession(executor: DbExecutor, tokenHash: string, now: string) {
  const [row] = await executor
    .update(operatorSession)
    .set({ revokedAt: now })
    .where(and(eq(operatorSession.tokenHash, tokenHash), isNull(operatorSession.revokedAt)))
    .returning({ id: operatorSession.id });
  return row;
}
/** 만료 후 보존 기한을 지난 연결만 정리한다. 활성 token은 grant 만료 뒤에도 보존한다. */
export function purgeOperatorSessions(executor: DbExecutor, before: string) {
  return executor
    .delete(operatorSession)
    .where(
      and(
        lt(operatorSession.expiresAt, before),
        or(isNull(operatorSession.tokenExpiresAt), lt(operatorSession.tokenExpiresAt, before)),
      ),
    );
}
