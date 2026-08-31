import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { apiErrorResponseSchema } from "@/shared/contracts/error";
import { completeSignupResponseSchema } from "@/shared/contracts/signup";

const completeSignup = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/services/signup-service", () => ({ completeSignup }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { POST } from "./route";

const challengeId = "00000000-0000-4000-8000-000000000001";
const input = { challengeId, nickname: "new-user", password: "Password!123" };

describe("POST /api/auth/signup/complete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates an account through the completion contract", async () => {
    completeSignup.mockResolvedValue({ accountId: "42" });

    const response = await POST(
      new Request("https://example.test/api/auth/signup/complete", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(completeSignupResponseSchema.parse(await response.json())).toEqual({ accountId: "42" });
    expect(completeSignup).toHaveBeenCalledWith(challengeId, "Password!123", "new-user");
  });

  it("rejects a password that does not satisfy the public contract", async () => {
    const response = await POST(
      new Request("https://example.test/api/auth/signup/complete", {
        body: JSON.stringify({ ...input, password: "short" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("VALIDATION_ERROR");
    expect(completeSignup).not.toHaveBeenCalled();
  });

  it("maps an already-registered email to conflict", async () => {
    completeSignup.mockRejectedValue(new AppError("EMAIL_ALREADY_REGISTERED"));

    const response = await POST(
      new Request("https://example.test/api/auth/signup/complete", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(409);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe(
      "EMAIL_ALREADY_REGISTERED",
    );
  });
});
