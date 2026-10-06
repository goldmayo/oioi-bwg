import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryCaptureException = vi.hoisted(() => vi.fn());

vi.mock("@sentry/nextjs", () => ({ captureException: sentryCaptureException }));

import { clientLogger } from "./client-logger";

describe("clientLogger", () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("writes browser diagnostics to console in local", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
    const consoleDebug = vi.spyOn(console, "debug").mockImplementation(() => undefined);
    const consoleInfo = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const consoleWarn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    clientLogger.debug("debug marker");
    clientLogger.info("info marker");
    clientLogger.warn("warn marker");
    clientLogger.error("error marker");

    expect(consoleDebug).toHaveBeenCalledWith("debug marker");
    expect(consoleInfo).toHaveBeenCalledWith("info marker");
    expect(consoleWarn).toHaveBeenCalledWith("warn marker");
    expect(consoleError).toHaveBeenCalledWith("error marker");
    expect(sentryCaptureException).not.toHaveBeenCalled();
  });

  it.each(["staging", "production", ""])(
    "is silent when NEXT_PUBLIC_APP_ENV is %s",
    (environment) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", environment);
      const consoleDebug = vi.spyOn(console, "debug").mockImplementation(() => undefined);

      clientLogger.debug("hidden marker");

      expect(consoleDebug).not.toHaveBeenCalled();
      expect(sentryCaptureException).not.toHaveBeenCalled();
    },
  );
});
