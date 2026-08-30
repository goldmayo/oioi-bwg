import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  consumeVerifiedChallenge: vi.fn(),
  insertAccount: vi.fn(),
  insertProfile: vi.fn(),
  insertPasswordCredential: vi.fn(),
}));

vi.mock("../db", () => ({
  getDatabase: () => ({
    transaction: async (callback: (tx: object) => Promise<unknown>) => callback({}),
  }),
}));

vi.mock("../repositories/email-verification-repository", () => ({
  consumeVerifiedChallenge: mocks.consumeVerifiedChallenge,
}));

vi.mock("../repositories/auth-repository", () => ({
  insertAccount: mocks.insertAccount,
  insertProfile: mocks.insertProfile,
  insertPasswordCredential: mocks.insertPasswordCredential,
}));

import { completeSignup } from "./signup-service";

describe("completeSignup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeVerifiedChallenge.mockResolvedValue([{ email: "user@example.com" }]);
    mocks.insertAccount.mockResolvedValue([{ id: 42n }]);
    mocks.insertProfile.mockResolvedValue(undefined);
    mocks.insertPasswordCredential.mockResolvedValue(undefined);
  });

  it("consumes a verified challenge and creates the identity rows", async () => {
    await expect(completeSignup("challenge-id", "Password!123", " user ")).resolves.toEqual({
      accountId: "42",
    });
    expect(mocks.consumeVerifiedChallenge).toHaveBeenCalled();
    expect(mocks.insertProfile).toHaveBeenCalledWith(expect.anything(), 42n, "user");
    expect(mocks.insertPasswordCredential).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ email: "user@example.com", accountId: 42n }),
    );
  });

  it("does not create an account without a verified challenge", async () => {
    mocks.consumeVerifiedChallenge.mockResolvedValueOnce([]);

    await expect(completeSignup("challenge-id", "Password!123", "user")).rejects.toMatchObject({
      code: "OTP_NOT_VERIFIED",
    });
    expect(mocks.insertAccount).not.toHaveBeenCalled();
  });
});
