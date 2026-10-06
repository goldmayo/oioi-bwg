import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  acquireOtpRequestLock: vi.fn(),
  insertChallenge: vi.fn(),
  incrementRateLimit: vi.fn(),
  findLatestChallengeForUpdate: vi.fn(),
  invalidatePendingChallenges: vi.fn(),
  sendSignupVerificationEmail: vi.fn(),
  invalidateChallenge: vi.fn(),
}));

vi.mock("../db", () => ({
  getDatabase: () => ({
    transaction: async (callback: (tx: object) => Promise<unknown>) => callback({}),
  }),
}));

vi.mock("../repositories/email-verification-repository", () => ({
  acquireOtpRequestLock: mocks.acquireOtpRequestLock,
  findChallengeById: vi.fn(),
  findLatestChallengeForUpdate: mocks.findLatestChallengeForUpdate,
  incrementFailedAttempts: vi.fn(),
  incrementRateLimit: mocks.incrementRateLimit,
  insertChallenge: mocks.insertChallenge,
  invalidateChallenge: mocks.invalidateChallenge,
  invalidatePendingChallenges: mocks.invalidatePendingChallenges,
  markChallengeVerified: vi.fn(),
}));

vi.mock("../email/signup-verification-email", () => ({
  sendSignupVerificationEmail: mocks.sendSignupVerificationEmail,
  SignupEmailSuppressedError: class extends Error {},
}));

vi.mock("../email/oci-email-delivery", () => ({
  isDefinitiveEmailDeliveryFailure: vi.fn(() => false),
}));

import { requestOtp } from "./email-verification-service";

describe("requestOtp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("AUTH_SECRET", "test-secret");
    mocks.acquireOtpRequestLock.mockResolvedValue(undefined);
    mocks.findLatestChallengeForUpdate.mockResolvedValue(undefined);
    mocks.incrementRateLimit.mockResolvedValue([{ requestCount: 1 }]);
    mocks.insertChallenge.mockResolvedValue([{ id: "00000000-0000-0000-0000-000000000001" }]);
    mocks.sendSignupVerificationEmail.mockResolvedValue({ mode: "dev" });
  });

  it("sends the generated OTP but returns only the challenge id", async () => {
    const result = await requestOtp(" User@example.com ", "127.0.0.1");

    expect(result).toEqual({ challengeId: "00000000-0000-0000-0000-000000000001" });
    expect(result).not.toHaveProperty("otp");
    expect(mocks.acquireOtpRequestLock).toHaveBeenCalledWith(expect.anything(), "user@example.com");
    expect(mocks.acquireOtpRequestLock.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.findLatestChallengeForUpdate.mock.invocationCallOrder[0]!,
    );
    expect(mocks.sendSignupVerificationEmail).toHaveBeenCalledWith(
      "user@example.com",
      expect.stringMatching(/^\d{6}$/),
    );
    expect(mocks.insertChallenge).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        email: "user@example.com",
        otpHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      }),
    );
    expect(mocks.insertChallenge.mock.calls[0]?.[1]?.otpHash).not.toBe(
      mocks.sendSignupVerificationEmail.mock.calls[0]?.[1],
    );
  });

  it("checks cooldown after locking and stops before issuing another challenge", async () => {
    mocks.findLatestChallengeForUpdate.mockResolvedValueOnce({
      lastSentAt: new Date().toISOString(),
    });

    await expect(requestOtp("USER@example.com", "127.0.0.1")).rejects.toMatchObject({
      code: "OTP_COOLDOWN",
    });

    expect(mocks.acquireOtpRequestLock).toHaveBeenCalledWith(expect.anything(), "user@example.com");
    expect(mocks.incrementRateLimit).not.toHaveBeenCalled();
    expect(mocks.invalidatePendingChallenges).not.toHaveBeenCalled();
    expect(mocks.insertChallenge).not.toHaveBeenCalled();
    expect(mocks.sendSignupVerificationEmail).not.toHaveBeenCalled();
  });

  it("does not report success when mail delivery fails", async () => {
    mocks.sendSignupVerificationEmail.mockRejectedValueOnce(new Error("network timeout"));

    await expect(requestOtp("user@example.com", "127.0.0.1")).rejects.toThrow("network timeout");
    expect(mocks.invalidateChallenge).not.toHaveBeenCalled();
  });
});
