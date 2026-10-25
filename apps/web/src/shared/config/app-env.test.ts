import { afterEach, describe, expect, it, vi } from "vitest";

import { getAppEnvironment, validateAppEnvironment } from "./app-env";

describe("app environment contract", () => {
  afterEach(() => vi.unstubAllEnvs());

  it.each(["local", "production"])(
    "accepts explicit %s independently of NODE_ENV",
    (environment) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", environment);
      for (const mode of ["development", "production", "test"] as const) {
        vi.stubEnv("NODE_ENV", mode);
        expect(getAppEnvironment()).toBe(environment);
        expect(validateAppEnvironment()).toBe(environment);
      }
    },
  );

  it.each(["staging", "development", "test", "production ", "INPUT_MARKER", "", undefined])(
    "rejects unsupported build input %s without exposing its value",
    (environment) => {
      vi.stubEnv("NODE_ENV", "production");
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", environment);
      expect(getAppEnvironment()).toBeUndefined();
      expect(validateAppEnvironment).toThrowError(
        "NEXT_PUBLIC_APP_ENV must be local or production.",
      );
    },
  );
});
