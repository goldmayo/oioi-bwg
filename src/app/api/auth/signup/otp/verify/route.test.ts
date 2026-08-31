import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { apiErrorResponseSchema } from "@/shared/contracts/error";
import { verifySignupOtpResponseSchema } from "@/shared/contracts/signup";

const verifyOtp = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/services/email-verification-service", () => ({ verifyOtp }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { POST } from "./route";

const challengeId = "00000000-0000-4000-8000-000000000001";

describe("POST /api/auth/signup/otp/verify", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the verified challenge contract", async () => {
    verifyOtp.mockResolvedValue({ challengeId });

    const response = await POST(
      new Request("https://example.test/api/auth/signup/otp/verify", {
        body: JSON.stringify({ challengeId, otp: "123456" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(200);
    expect(verifySignupOtpResponseSchema.parse(await response.json())).toEqual({
      challengeId,
      verified: true,
    });
    expect(verifyOtp).toHaveBeenCalledWith(challengeId, "123456");
  });

  it("rejects an invalid OTP shape before calling the service", async () => {
    const response = await POST(
      new Request("https://example.test/api/auth/signup/otp/verify", {
        body: JSON.stringify({ challengeId, otp: "12345" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("VALIDATION_ERROR");
    expect(verifyOtp).not.toHaveBeenCalled();
  });

  it("maps an invalid OTP to its public error contract", async () => {
    verifyOtp.mockRejectedValue(new AppError("OTP_INVALID"));

    const response = await POST(
      new Request("https://example.test/api/auth/signup/otp/verify", {
        body: JSON.stringify({ challengeId, otp: "123456" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("OTP_INVALID");
  });
});
