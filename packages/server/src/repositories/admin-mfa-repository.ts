import "server-only";

import { and, eq, isNull, lt, or, sql } from "drizzle-orm";

import type { DbExecutor } from "../db";
import { account, adminMfa, passwordCredential } from "../db/schema";

export function findAdminMfa(executor: DbExecutor, accountId: bigint) {
  return executor.query.adminMfa.findFirst({
    where: (table, { eq: equals }) => equals(table.accountId, accountId),
  });
}

// 인증·등록 허용 여부는 호출하는 service가 확인한다.
export async function ensurePendingAdminMfa(
  executor: DbExecutor,
  accountId: bigint,
  encryptedSecret: string,
) {
  const [pending] = await executor
    .insert(adminMfa)
    .values({ accountId, encryptedSecret })
    .onConflictDoUpdate({
      target: adminMfa.accountId,
      set: {
        encryptedSecret: sql`coalesce(${adminMfa.encryptedSecret}, excluded.encrypted_secret)`,
      },
      setWhere: isNull(adminMfa.enabledAt),
    })
    .returning();
  return pending;
}

export function resetAdminMfa(executor: DbExecutor, accountId: bigint, expectedVersion: number) {
  return executor
    .update(adminMfa)
    .set({
      encryptedSecret: null,
      enabledAt: null,
      lastUsedStep: null,
      version: sql`${adminMfa.version} + 1`,
    })
    .where(and(eq(adminMfa.accountId, accountId), eq(adminMfa.version, expectedVersion)))
    .returning({ version: adminMfa.version });
}

export function incrementAdminMfaVersion(executor: DbExecutor, accountId: bigint) {
  return executor
    .insert(adminMfa)
    .values({ accountId })
    .onConflictDoUpdate({
      target: adminMfa.accountId,
      set: { version: sql`${adminMfa.version} + 1` },
    })
    .returning({ version: adminMfa.version });
}

// 호출 service의 transaction 안에서 사용한다. 모든 mutation의 lock 순서는 같다.
export async function lockConsoleAuthenticationFacts(executor: DbExecutor, accountId: bigint) {
  const [currentAccount] = await executor
    .select()
    .from(account)
    .where(eq(account.id, accountId))
    .for("update");
  const [credential] = await executor
    .select()
    .from(passwordCredential)
    .where(eq(passwordCredential.accountId, accountId))
    .for("update");
  const [mfa] = await executor
    .select()
    .from(adminMfa)
    .where(eq(adminMfa.accountId, accountId))
    .for("update");
  return { account: currentAccount, credential, mfa };
}

export function consumeAdminMfaStep(
  executor: DbExecutor,
  expected: {
    accountId: bigint;
    version: number;
    encryptedSecret: string;
    enabledAt: string | null;
  },
  step: number,
  confirmedAt: string,
) {
  return executor
    .update(adminMfa)
    .set({ lastUsedStep: step, enabledAt: expected.enabledAt ?? confirmedAt })
    .where(
      and(
        eq(adminMfa.accountId, expected.accountId),
        eq(adminMfa.version, expected.version),
        eq(adminMfa.encryptedSecret, expected.encryptedSecret),
        expected.enabledAt === null
          ? isNull(adminMfa.enabledAt)
          : eq(adminMfa.enabledAt, expected.enabledAt),
        or(isNull(adminMfa.lastUsedStep), lt(adminMfa.lastUsedStep, step)),
      ),
    )
    .returning({ version: adminMfa.version });
}
