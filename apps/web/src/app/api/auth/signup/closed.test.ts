import { apiErrorResponseSchema } from "@oioi-bwg/contracts/error";
import { expect, test, vi } from "vitest";

const effects = vi.hoisted(() => ({
  requestOtp: vi.fn(),
  verifyOtp: vi.fn(),
  completeSignup: vi.fn(),
}));
vi.mock("@oioi-bwg/server/services/email-verification-service", () => effects);
vi.mock("@oioi-bwg/server/services/signup-service", () => effects);

import { POST as complete } from "./complete/route";
import { POST as otp } from "./otp/route";
import { POST as verify } from "./otp/verify/route";

test.each([
  ["otp", otp],
  ["otp/verify", verify],
  ["complete", complete],
] as const)(
  "closed signup %s rejects without parsing input or calling a mutation service",
  async (path, handler) => {
    const request = new Request("https://example.test/api/auth/signup/" + path, {
      method: "POST",
      body: "{malformed",
    });
    const json = vi.spyOn(request, "json").mockRejectedValue(new Error("must not parse"));
    const invoke: (input: Request) => Response = handler;
    const response = invoke(request);
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("FORBIDDEN");
    expect(json).not.toHaveBeenCalled();
    for (const effect of Object.values(effects)) expect(effect).not.toHaveBeenCalled();
  },
);
