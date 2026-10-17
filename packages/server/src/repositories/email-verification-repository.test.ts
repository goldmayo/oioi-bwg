import { describe, expect, it, vi } from "vitest";

import { emailVerificationChallenge } from "../db/schema";

import { consumeVerifiedChallenge } from "./email-verification-repository";

describe("consumeVerifiedChallenge", () => {
  it("transitions VERIFIED to the CHECK-compatible CONSUMED timestamps", async () => {
    const returning = vi.fn().mockResolvedValue([{ email: "user@example.com" }]);
    const where = vi.fn(() => ({ returning }));
    const set = vi.fn(() => ({ where }));
    const update = vi.fn(() => ({ set }));
    const now = "2026-09-06T00:00:00.000Z";

    await expect(
      consumeVerifiedChallenge({ update } as never, "challenge-id", now),
    ).resolves.toEqual([{ email: "user@example.com" }]);

    expect(update).toHaveBeenCalledWith(emailVerificationChallenge);
    expect(set).toHaveBeenCalledWith({
      status: "CONSUMED",
      verifiedAt: null,
      consumedAt: now,
    });
    expect(where).toHaveBeenCalledOnce();
    expect(returning).toHaveBeenCalledWith({ email: emailVerificationChallenge.email });
  });
});
