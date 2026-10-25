import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const logServerError = vi.hoisted(() => vi.fn());
const id = "0123456789abcdef0123456789abcdef";
const captureServerException = vi.hoisted(() => vi.fn());
vi.mock("./server-logger", () => ({ logServerError }));
vi.mock("./server-sentry-reporter", () => ({ captureServerException }));
import { reportServerError } from "./server-error-reporter";
const context = {
  event: "api.unexpected_error",
  source: "api-route-handler",
  requestId: "48be30fa-1441-4dc9-8ffa-9b618ec32652",
} as const;
describe("request-scoped reporting", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    captureServerException.mockReturnValue(id);
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "http://public@localhost/1");
  });
  afterEach(() => vi.unstubAllEnvs());
  it("joins the original error and SDK submission ID without claiming receipt", () => {
    const error = new Error("private");
    expect(reportServerError(error, context)).toBe(id);
    expect(captureServerException).toHaveBeenCalledWith(error, context);
    expect(logServerError).toHaveBeenCalledWith(error, context, {
      status: "requested",
      eventId: id,
    });
  });
  it("deduplicates only the same object in the same verified request", () => {
    const error = new Error();
    reportServerError(error, context);
    reportServerError(error, context);
    reportServerError(error, { ...context, requestId: "bd6539f6-1f7a-4020-806e-d4fe91beae65" });
    reportServerError(new Error(), context);
    expect(logServerError).toHaveBeenCalledTimes(3);
  });
  it("does not merge missing-ID observations", () => {
    const error = new Error();
    reportServerError(error, { ...context, requestId: undefined });
    reportServerError(error, { ...context, requestId: undefined });
    expect(logServerError).toHaveBeenCalledTimes(2);
  });
  it("keeps the JSON sink when Sentry is disabled or throws", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
    expect(reportServerError(new Error(), context)).toBeNull();
    expect(logServerError).toHaveBeenLastCalledWith(expect.any(Error), context, {
      status: "disabled",
    });
    captureServerException.mockImplementationOnce(() => {
      throw new Error("sink failure");
    });
    expect(() => reportServerError(new Error(), context)).not.toThrow();
    expect(logServerError).toHaveBeenLastCalledWith(expect.any(Error), context, {
      status: "capture_failed",
    });
  });
  it("does not replace the application error with a logging failure", () => {
    logServerError.mockImplementationOnce(() => {
      throw new Error();
    });
    expect(reportServerError(new Error(), context)).toBe(id);
  });
});
