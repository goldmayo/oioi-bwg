import type { DbExecutor } from "../db";
import { account, passwordCredential, profile } from "../db/schema";

export function insertAccount(executor: DbExecutor) {
  return executor
    .insert(account)
    .values({ role: "USER", status: "ACTIVE" })
    .returning({ id: account.id });
}

export function insertProfile(executor: DbExecutor, accountId: bigint, nickname: string) {
  return executor.insert(profile).values({ accountId, nickname });
}

export function insertPasswordCredential(
  executor: DbExecutor,
  data: typeof passwordCredential.$inferInsert,
) {
  return executor.insert(passwordCredential).values(data);
}

export function findPasswordCredentialByEmail(executor: DbExecutor, email: string) {
  return executor.query.passwordCredential.findFirst({
    where: (table, { eq: equals }) => equals(table.email, email),
    columns: {
      accountId: true,
      passwordHash: true,
    },
    with: {
      account: {
        columns: {
          id: true,
          status: true,
        },
      },
    },
  });
}

export function findAuthorizationFactsByAccountId(executor: DbExecutor, accountId: bigint) {
  return executor.query.account.findFirst({
    where: (table, { eq: equals }) => equals(table.id, accountId),
    columns: {
      id: true,
      role: true,
      status: true,
    },
  });
}
