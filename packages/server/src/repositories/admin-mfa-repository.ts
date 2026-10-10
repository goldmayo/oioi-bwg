import "server-only";

import { and, eq, isNull, sql } from "drizzle-orm";

import type { DbExecutor } from "../db";
import { adminMfa } from "../db/schema";

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
