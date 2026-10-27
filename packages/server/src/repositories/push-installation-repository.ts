import "server-only";
import { and, eq, sql } from "drizzle-orm";
import type { DbExecutor } from "../db";
import { pushInstallation } from "../db/schema";

export async function bindPushInstallation(
  db: DbExecutor,
  input: { fid: string; accountId: string; mfaVersion: number; expiresAt: string },
) {
  const [row] = await db
    .insert(pushInstallation)
    .values(input)
    .onConflictDoUpdate({
      target: pushInstallation.fid,
      set: {
        accountId: input.accountId,
        mfaVersion: input.mfaVersion,
        expiresAt: input.expiresAt,
        enabled: true,
        updatedAt: sql`now()`,
        bindingVersion: sql`case when ${pushInstallation.accountId} = ${input.accountId} and ${pushInstallation.mfaVersion} = ${input.mfaVersion} and ${pushInstallation.enabled} and ${pushInstallation.expiresAt} > now() then ${pushInstallation.bindingVersion} else ${pushInstallation.bindingVersion} + 1 end`,
      },
    })
    .returning({ id: pushInstallation.id, bindingVersion: pushInstallation.bindingVersion });
  return row!;
}
export function disablePushInstallation(db: DbExecutor, accountId: string, id: string) {
  return db
    .update(pushInstallation)
    .set({
      enabled: false,
      bindingVersion: sql`${pushInstallation.bindingVersion} + 1`,
      updatedAt: sql`now()`,
    })
    .where(
      and(
        eq(pushInstallation.accountId, accountId),
        eq(pushInstallation.id, id),
        eq(pushInstallation.enabled, true),
      ),
    );
}
