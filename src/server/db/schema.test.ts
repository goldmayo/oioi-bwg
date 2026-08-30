import { getTableConfig } from "drizzle-orm/pg-core";

import { account, ACCOUNT_ROLES, ACCOUNT_STATUSES, passwordCredential, profile } from "./schema";

describe("M5 identity persistence schema", () => {
  it("uses the canonical domain role and account status vocabulary", () => {
    expect(ACCOUNT_ROLES).toEqual(["USER", "REVIEWER", "ADMIN"]);
    expect(ACCOUNT_STATUSES).toEqual(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "DELETED"]);
  });

  it("keeps identity tables and columns in lowercase snake_case", () => {
    expect(getTableConfig(account).name).toBe("account");
    expect(getTableConfig(profile).name).toBe("profile");
    expect(getTableConfig(passwordCredential).name).toBe("password_credential");

    expect(account.createdAt.name).toBe("created_at");
    expect(account.deletedAt.name).toBe("deleted_at");
    expect(getTableConfig(profile).columns.map(({ name }) => name)).toEqual([
      "account_id",
      "nickname",
      "avatar_url",
      "updated_at",
    ]);
    expect(passwordCredential.passwordHash.name).toBe("password_hash");
  });

  it("declares the identity checks and one-to-one account foreign keys", () => {
    const accountConfig = getTableConfig(account);
    const profileConfig = getTableConfig(profile);
    const credentialConfig = getTableConfig(passwordCredential);

    expect(accountConfig.checks.map(({ name }) => name)).toEqual([
      "account_role_check",
      "account_status_check",
      "account_deleted_at_check",
    ]);
    expect(credentialConfig.checks.map(({ name }) => name)).toEqual([
      "password_credential_email_check",
      "password_credential_hash_check",
    ]);
    expect(profile.nickname.isUnique).toBe(true);
    expect(profile.nickname.uniqueName).toBe("profile_nickname_key");
    expect(passwordCredential.email.isUnique).toBe(true);
    expect(passwordCredential.email.uniqueName).toBe("password_credential_email_key");

    expect(profileConfig.foreignKeys[0]?.getName()).toBe("profile_account_id_fkey");
    expect(profileConfig.foreignKeys[0]?.onDelete).toBe("restrict");
    expect(credentialConfig.foreignKeys[0]?.getName()).toBe("password_credential_account_id_fkey");
    expect(credentialConfig.foreignKeys[0]?.onDelete).toBe("restrict");
  });
});
