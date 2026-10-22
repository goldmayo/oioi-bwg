import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  eventFromException: vi.fn(async () => ({ type: undefined })),
  captureEvent: vi.fn(() => "event-id"),
  setTags: vi.fn(),
  setContext: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  getClient: () => ({ eventFromException: sentryMocks.eventFromException }),
  getCurrentScope: () => ({
    clone: () => ({
      setContext: sentryMocks.setContext,
      setTags: sentryMocks.setTags,
      captureEvent: sentryMocks.captureEvent,
    }),
  }),
}));

import { captureClientException } from "./sentry";

describe("Sentry error reporter", () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("stays silent locally and does not capture", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    expect(
      await captureClientException(new Error("TOKEN_MARKER", { cause: "PASSWORD_MARKER" }), {
        source: "admin-login-form",
      }),
    ).toBeNull();

    expect(sentryMocks.eventFromException).not.toHaveBeenCalled();
    expect(sentryMocks.captureEvent).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });

  it.each(["staging", "production"])("captures an allowlisted error in %s", async (environment) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", environment);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
    const error = Object.assign(new Error("private response"), { name: "ClientContractError" });

    expect(
      await captureClientException(error, {
        source: "admin-error-boundary",
        outcome: "error_boundary_mounted",
        digest: "safe_digest-123",
      }),
    ).toBe("event-id");

    expect(sentryMocks.eventFromException).toHaveBeenCalledWith(error);
    expect(sentryMocks.captureEvent).toHaveBeenCalledWith({ type: undefined });
    expect(sentryMocks.setTags).toHaveBeenCalledWith({
      app: "console",
      runtime: "browser",
      source: "admin-error-boundary",
      outcome: "error_boundary_mounted",
      "error.type": "client-contract",
      "error.digest": "safe_digest-123",
    });
  });

  it("does not create an unhandled rejection when SDK projection fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
    sentryMocks.eventFromException.mockRejectedValueOnce(new Error("SDK failure"));

    await expect(
      captureClientException(new Error("original failure"), { source: "query-cache" }),
    ).resolves.toBeNull();
    expect(sentryMocks.captureEvent).not.toHaveBeenCalled();
  });
});

it("carries HTTP correlation through the browser reporter", async () => {
  vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
  vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "http://public@localhost/1");
  const { rememberErrorRequestId } = await import("./observability-correlation");
  const id = "48be30fa-1441-4dc9-8ffa-9b618ec32652";
  const error = rememberErrorRequestId(new Error(), id);
  await captureClientException(error, { source: "query-cache" });
  expect(sentryMocks.setContext).toHaveBeenCalledWith("correlation", { request_id: id });
  vi.unstubAllEnvs();
});
