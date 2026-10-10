import "server-only";

import { getDatabase } from "../db";
import type { AccountRole } from "../db/schema";
import { AppError } from "../errors/app-error";
import {
  incrementAdminMfaVersion,
  lockConsoleAuthenticationFacts,
  resetAdminMfa,
} from "../repositories/admin-mfa-repository";
import { updateAccountAccess } from "../repositories/auth-repository";

// 운영 권한/DB 실행 guard는 B3 CLI가 소유한다. 브라우저 reset 경로는 제공하지 않는다.
export function resetConsoleMfa(accountId: bigint, expectedVersion: number | null) {
  return getDatabase().transaction(async (tx) => {
    const current = await lockConsoleAuthenticationFacts(tx, accountId);
    if (!current.account || (current.mfa?.version ?? null) !== expectedVersion)
      throw new AppError("FORBIDDEN");
    const rows = current.mfa
      ? await resetAdminMfa(tx, accountId, current.mfa.version)
      : await incrementAdminMfaVersion(tx, accountId);
    if (rows.length !== 1) throw new AppError("FORBIDDEN");
    return {
      accountId: accountId.toString(),
      previousVersion: expectedVersion,
      version: rows[0]!.version,
    };
  });
}

type Access = { role: AccountRole; status: "ACTIVE" | "SUSPENDED" };

export function changeConsoleAccountAccess(
  accountId: bigint,
  expected: Access & { version: number | null },
  next: Access,
) {
  return getDatabase().transaction(async (tx) => {
    const current = await lockConsoleAuthenticationFacts(tx, accountId);
    if (
      !current.account ||
      current.account.role !== expected.role ||
      current.account.status !== expected.status ||
      (current.mfa?.version ?? null) !== expected.version ||
      ![expected.status, next.status].every(
        (status) => status === "ACTIVE" || status === "SUSPENDED",
      )
    ) {
      throw new AppError("FORBIDDEN");
    }
    await updateAccountAccess(tx, accountId, next.role, next.status);
    const [updated] = await incrementAdminMfaVersion(tx, accountId);
    if (!updated) throw new AppError("FORBIDDEN");
    return {
      accountId: accountId.toString(),
      previousVersion: expected.version,
      version: updated.version,
      role: next.role,
      status: next.status,
    };
  });
}
