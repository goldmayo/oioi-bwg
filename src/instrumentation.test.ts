import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportServerError } from "@/server/observability/server-logger";

import { onRequestError } from "./instrumentation";

vi.mock("@/server/observability/server-logger", () => ({ reportServerError: vi.fn() }));

const mockedReportServerError = vi.mocked(reportServerError);

describe("onRequestError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NODE_ENV", "production");
  });

  it("forwards only allowlisted request metadata to the safe reporter", async () => {
    const error = new Error("SQL_MARKER", {
      cause: { params: ["EMAIL_MARKER", "PASSWORD_HASH_MARKER"] },
    });

    await onRequestError(
      error,
      {
        method: "POST",
        path: "/private?token=TOKEN_MARKER",
        headers: { cookie: "COOKIE_MARKER", authorization: "AUTHORIZATION_MARKER" },
      },
      {
        routerKind: "App Router",
        routeType: "route",
        routePath: "/private/[token]/TOKEN_MARKER",
        nested: { email: "EMAIL_MARKER" },
      },
    );

    expect(mockedReportServerError).toHaveBeenCalledWith(error, {
      event: "next.request_error",
      source: "next-instrumentation",
      request: { method: "POST", routerKind: "App Router", routeType: "route" },
    });
    expect(JSON.stringify(mockedReportServerError.mock.calls[0]?.[1])).not.toMatch(
      /TOKEN_MARKER|COOKIE_MARKER|AUTHORIZATION_MARKER|EMAIL_MARKER/,
    );
  });

  it("drops unknown metadata values and skips development capture", async () => {
    await onRequestError(
      new Error("marker"),
      { method: "SECRET_METHOD" },
      {
        routerKind: "SECRET_ROUTER",
        routeType: "SECRET_ROUTE",
      },
    );

    expect(mockedReportServerError).toHaveBeenCalledWith(expect.any(Error), {
      event: "next.request_error",
      source: "next-instrumentation",
      request: { method: undefined, routerKind: undefined, routeType: undefined },
    });

    vi.stubEnv("NODE_ENV", "development");
    await onRequestError(new Error("marker"), { method: "POST" }, {});
    expect(mockedReportServerError).toHaveBeenCalledTimes(1);
  });
});
