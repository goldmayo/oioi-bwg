import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { forbidden, redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getAdminPageContext, rethrowAdminPageError } from "./admin-page-context";
import { getRequestContext, type RequestContext } from "./request-context";

vi.mock("./request-context", () => ({ getRequestContext: vi.fn() }));

const redirectSignal = new Error("redirect control flow");
const forbiddenSignal = new Error("forbidden control flow");
vi.mock("next/navigation", () => ({ redirect: vi.fn(), forbidden: vi.fn() }));

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(redirect).mockImplementation(() => {
    throw redirectSignal;
  });
  vi.mocked(forbidden).mockImplementation(() => {
    throw forbiddenSignal;
  });
});

describe("admin page context", () => {
  it("requests login for a guest before returning a context", async () => {
    vi.mocked(getRequestContext).mockResolvedValue({
      user: null,
      ability: buildAbility({ accountId: null, role: null }),
    });
    await expect(getAdminPageContext()).rejects.toBe(redirectSignal);
    expect(redirect).toHaveBeenCalledWith("/admin-login");
    expect(forbidden).not.toHaveBeenCalled();
  });

  it("denies an authenticated context without manage all", async () => {
    vi.mocked(getRequestContext).mockResolvedValue({
      user: { id: "42" },
      ability: buildAbility({ accountId: "42", role: "USER" }),
    });
    await expect(getAdminPageContext()).rejects.toBe(forbiddenSignal);
    expect(redirect).not.toHaveBeenCalled();
  });

  it("returns the same request context for an administrator", async () => {
    const context: RequestContext = {
      user: { id: "42" },
      ability: buildAbility({ accountId: "42", role: "ADMIN" }),
    };
    vi.mocked(getRequestContext).mockResolvedValue(context);
    await expect(getAdminPageContext()).resolves.toBe(context);
    expect(getRequestContext).toHaveBeenCalledTimes(1);
  });

  it("keeps a context loading failure as the original error", async () => {
    const error = new Error("database unavailable");
    vi.mocked(getRequestContext).mockRejectedValue(error);
    await expect(getAdminPageContext()).rejects.toBe(error);
    expect(redirect).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });
});

describe("admin service error translation", () => {
  it.each([
    ["UNAUTHENTICATED", redirectSignal],
    ["FORBIDDEN", forbiddenSignal],
  ] as const)("translates %s without swallowing framework control flow", (code, signal) => {
    expect(() => rethrowAdminPageError(new AppError(code))).toThrow(signal);
  });

  it.each([
    new AppError("SONG_NOT_FOUND"),
    new TypeError("unexpected render failure"),
    redirectSignal,
    forbiddenSignal,
    { code: "UNAUTHENTICATED", message: "untrusted error-shaped input" },
  ])("rethrows an untranslated failure unchanged", (error) => {
    expect.assertions(3);
    try {
      rethrowAdminPageError(error);
    } catch (actual) {
      expect(actual).toBe(error);
    }
    expect(redirect).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });
});
