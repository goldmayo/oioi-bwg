import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RequestAuthorization } from "@/server/auth/request-context";

import { logAuthRejection, logCredentialsRejection } from "./auth-rejection-logger";

afterEach(() => vi.restoreAllMocks());

describe("safe auth rejection logging", () => {
  it("logs once for the same request state and keeps separate requests", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const createState = (): RequestAuthorization => ({
      context: {
        user: { id: "PRIVATE_ID" },
        ability: buildAbility({ accountId: "PRIVATE_ID", role: "ADMIN" }),
      },
      decision: "mfa_version_mismatch",
      rejectionLogged: false,
    });
    const state = createState();
    logAuthRejection(state, "login_redirect_requested", "admin-rsc");
    logAuthRejection(state, "login_redirect_requested", "admin-rsc");
    logAuthRejection(createState(), "response_created", "api-route-handler", {
      status: 401,
      route: "/api/admin/songs",
    });
    expect(info).toHaveBeenCalledTimes(2);
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toMatchObject({
      event: "auth.rejected",
      level: "info",
      reason: "mfa_version_mismatch",
      outcome: "login_redirect_requested",
    });
    expect(JSON.stringify(info.mock.calls)).not.toContain("PRIVATE_ID");
    expect(JSON.parse(String(info.mock.calls[1]?.[0]))).toMatchObject({ "http.status_code": 401 });
  });
  it("uses a generic credentials reason and suppresses repeated logger delivery", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const error = new Error("PRIVATE_EMAIL TOKEN OTP");
    logCredentialsRejection(error);
    logCredentialsRejection(error);
    expect(info).toHaveBeenCalledOnce();
    expect(String(info.mock.calls[0]?.[0])).not.toMatch(/PRIVATE_EMAIL|TOKEN|OTP/);
    expect(JSON.parse(String(info.mock.calls[0]?.[0]))).toMatchObject({
      reason: "credentials_rejected",
      outcome: "unknown",
    });
  });
});
