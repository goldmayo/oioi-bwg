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
