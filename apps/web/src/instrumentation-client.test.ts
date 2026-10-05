import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({ init: vi.fn() }));

vi.mock("@sentry/nextjs", () => ({ init: sentryMocks.init }));

describe("client Sentry instrumentation", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("does not initialize Sentry locally even in production runtime mode", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");

    await import("./instrumentation-client");

    expect(sentryMocks.init).not.toHaveBeenCalled();
  });

  it.each(["staging", "production"])(
    "initializes error-only Sentry policy in %s",
    async (environment) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", environment);
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");

      await import("./instrumentation-client");

      expect(sentryMocks.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: "https://public@example.test/1",
          environment,
          sendDefaultPii: false,
          beforeSend: expect.any(Function),
          beforeBreadcrumb: expect.any(Function),
          integrations: expect.any(Function),
          replaysSessionSampleRate: 0,
          replaysOnErrorSampleRate: 0,
        }),
      );
      expect(sentryMocks.init.mock.calls[0]?.[0]).not.toHaveProperty("tracesSampleRate");

      const filterIntegrations = sentryMocks.init.mock.calls[0]?.[0].integrations;
      expect(
        filterIntegrations([
          { name: "BrowserTracing" },
          { name: "GlobalHandlers" },
          { name: "Replay" },
        ]),
      ).toEqual([{ name: "GlobalHandlers" }]);
    },
  );
});
