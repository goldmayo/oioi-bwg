import { afterEach, describe, expect, it, vi } from "vitest";

import { getSentryRuntimeConfig } from "./sentry";

describe("getSentryRuntimeConfig", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["local", "development", "test", "", undefined])(
    "keeps Sentry disabled for %s",
    (appEnvironment) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", appEnvironment);
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");

      expect(getSentryRuntimeConfig()).toEqual({
        dsn: "https://public@example.test/1",
        enabled: false,
        environment: undefined,
      });
    },
  );

  it.each(["staging", "production"])("enables %s only when a DSN exists", (appEnvironment) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", appEnvironment);
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");

    expect(getSentryRuntimeConfig()).toEqual({
      dsn: "https://public@example.test/1",
      enabled: true,
      environment: appEnvironment,
    });

    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "  ");
    expect(getSentryRuntimeConfig()).toEqual({
      dsn: "",
      enabled: false,
      environment: appEnvironment,
    });
  });

  it("does not use NODE_ENV as an activation signal", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");

    expect(getSentryRuntimeConfig().enabled).toBe(false);
  });
});
