import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { apiErrorResponseSchema } from "@/shared/contracts/error";
import { signupOtpResponseSchema } from "@/shared/contracts/signup";

const requestOtp = vi.hoisted(() => vi.fn());
const headers = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers }));
vi.mock("@/server/services/email-verification-service", () => ({ requestOtp }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { POST } from "./route";

const challengeId = "00000000-0000-4000-8000-000000000001";

describe("POST /api/auth/signup/otp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.1, 10.0.0.1" }));
  });

  it("creates a challenge with the canonical email and first forwarded IP", async () => {
    requestOtp.mockResolvedValue({ challengeId });

    const response = await POST(
      new Request("https://example.test/api/auth/signup/otp", {
        body: JSON.stringify({ email: " User@example.com " }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(signupOtpResponseSchema.parse(await response.json())).toEqual({ challengeId });
    expect(requestOtp).toHaveBeenCalledWith("User@example.com", "203.0.113.1");
  });

  it("rejects an invalid email before calling the service", async () => {
    const response = await POST(
      new Request("https://example.test/api/auth/signup/otp", {
        body: JSON.stringify({ email: "not-an-email" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("VALIDATION_ERROR");
    expect(requestOtp).not.toHaveBeenCalled();
  });

  it("maps cooldown to a public rate-limit response", async () => {
    requestOtp.mockRejectedValue(new AppError("OTP_COOLDOWN"));

    const response = await POST(
      new Request("https://example.test/api/auth/signup/otp", {
        body: JSON.stringify({ email: "user@example.com" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(429);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("OTP_COOLDOWN");
  });
});
