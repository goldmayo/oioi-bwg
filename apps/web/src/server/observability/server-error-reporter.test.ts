import { beforeEach, describe, expect, it, vi } from "vitest";

const logServerError = vi.hoisted(() => vi.fn());
const captureServerException = vi.hoisted(() => vi.fn(() => "event-id"));

vi.mock("./server-logger", () => ({ logServerError }));
vi.mock("./server-sentry-reporter", () => ({ captureServerException }));

import { reportServerError } from "./server-error-reporter";

describe("reportServerError", () => {
  beforeEach(() => vi.clearAllMocks());

  it("explicitly coordinates the independent server log and Sentry sinks", () => {
    const error = new Error("private marker");
    const context = {
      event: "api.unexpected_error",
      source: "api-route-handler",
    } as const;

    expect(reportServerError(error, context)).toBe("event-id");

    expect(logServerError).toHaveBeenCalledWith(error, context);
    expect(captureServerException).toHaveBeenCalledWith(error, context);
  });
});
