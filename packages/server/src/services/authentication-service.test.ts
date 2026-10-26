import argon2 from "argon2";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getDatabase } from "../db";
import { findPasswordCredentialByEmail } from "../repositories/auth-repository";

import { authenticateCredentials } from "./authentication-service";

vi.mock("argon2", () => ({
  default: {
    verify: vi.fn(),
  },
}));
vi.mock("../db", () => ({ getDatabase: vi.fn() }));
vi.mock("../repositories/auth-repository", () => ({
  findPasswordCredentialByEmail: vi.fn(),
}));

const mockedGetDatabase = vi.mocked(getDatabase);
const mockedFindCredential = vi.mocked(findPasswordCredentialByEmail);
const mockedVerify = vi.mocked(argon2.verify);

describe("authenticateCredentials", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedGetDatabase.mockReturnValue({} as never);
    mockedVerify.mockResolvedValue(true);
  });

  it("canonicalizes email and returns only the account identity", async () => {
    mockedFindCredential.mockResolvedValue({
      accountId: "019a0170-0000-7000-8000-00000000002a",
      passwordHash: "$argon2id$stored-hash",
      account: { id: "019a0170-0000-7000-8000-00000000002a", status: "ACTIVE" },
    });

    await expect(authenticateCredentials("  ADMIN@EXAMPLE.COM ", "password")).resolves.toEqual({
      id: "019a0170-0000-7000-8000-00000000002a",
    });
    expect(mockedFindCredential).toHaveBeenCalledWith(expect.anything(), "admin@example.com");
    expect(mockedVerify).toHaveBeenCalledWith("$argon2id$stored-hash", "password");
  });

  it("rejects invalid credentials and non-active accounts", async () => {
    mockedFindCredential.mockResolvedValue({
      accountId: "019a0170-0000-7000-8000-00000000002a",
      passwordHash: "$argon2id$stored-hash",
      account: { id: "019a0170-0000-7000-8000-00000000002a", status: "SUSPENDED" },
    });

    await expect(authenticateCredentials("admin@example.com", "password")).resolves.toBeNull();
  });

  it("performs a password verification even when the account is missing", async () => {
    mockedFindCredential.mockResolvedValue(undefined);

    await expect(authenticateCredentials("missing@example.com", "password")).resolves.toBeNull();
    expect(mockedVerify).toHaveBeenCalledWith(expect.stringContaining("$argon2id$"), "password");
  });
});
