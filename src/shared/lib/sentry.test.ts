import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => "event-id"),
  setTags: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: sentryMocks.captureException,
  withScope: (callback: (scope: { setTags: (tags: Record<string, unknown>) => void }) => void) => {
    sentryMocks.withScope(callback);
    callback({ setTags: sentryMocks.setTags });
  },
}));

import { logger } from "./sentry";

describe("Sentry error reporter", () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("uses only safe diagnostics locally and does not capture", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(
      logger.error(new Error("TOKEN_MARKER", { cause: "PASSWORD_MARKER" }), {
        source: "admin-login-form",
      }),
    ).toBeNull();

    expect(sentryMocks.captureException).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalledWith("[Sentry Dev Error]", {
      name: "Error",
      source: "admin-login-form",
      errorType: "runtime",
    });
    expect(JSON.stringify(consoleError.mock.calls)).not.toMatch(/TOKEN_MARKER|PASSWORD_MARKER/);
  });

  it.each(["staging", "production"])("captures an allowlisted error in %s", (environment) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", environment);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
    const error = Object.assign(new Error("private response"), { name: "ClientContractError" });

    expect(
      logger.error(error, {
        source: "admin-error-boundary",
        digest: "safe_digest-123",
      }),
    ).toBe("event-id");

    expect(sentryMocks.captureException).toHaveBeenCalledWith(error);
    expect(sentryMocks.setTags).toHaveBeenCalledWith({
      source: "admin-error-boundary",
      "error.type": "client-contract",
      "error.digest": "safe_digest-123",
    });
  });
});
