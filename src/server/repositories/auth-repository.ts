import type { DbExecutor } from "../db";
import { isPostgresUniqueViolation } from "../db/postgres-error";
import { account, passwordCredential, profile } from "../db/schema";

import {
  PasswordCredentialEmailConflictError,
  ProfileNicknameConflictError,
} from "./repository-error";

export function insertAccount(executor: DbExecutor) {
  return executor
    .insert(account)
    .values({ role: "USER", status: "ACTIVE" })
    .returning({ id: account.id });
}

export async function insertProfile(executor: DbExecutor, accountId: bigint, nickname: string) {
  try {
    return await executor.insert(profile).values({ accountId, nickname });
  } catch (error) {
    if (isPostgresUniqueViolation(error, "profile_nickname_key")) {
      throw new ProfileNicknameConflictError();
    }
    throw error;
  }
}

export async function insertPasswordCredential(
  executor: DbExecutor,
  data: typeof passwordCredential.$inferInsert,
) {
  try {
    return await executor.insert(passwordCredential).values(data);
  } catch (error) {
    if (isPostgresUniqueViolation(error, "password_credential_email_key")) {
      throw new PasswordCredentialEmailConflictError();
    }
    throw error;
  }
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
