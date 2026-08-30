import type { DbExecutor } from "../db";

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
