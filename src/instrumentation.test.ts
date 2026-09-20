import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportServerError } from "@/server/observability/server-error-reporter";

import { onRequestError } from "./instrumentation";

vi.mock("@/server/observability/server-error-reporter", () => ({ reportServerError: vi.fn() }));

const mockedReportServerError = vi.mocked(reportServerError);

describe("onRequestError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
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

  it("drops unknown metadata values and still reports when Sentry is disabled", async () => {
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

    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const disabledSentryError = new Error("disabled Sentry marker");
    await onRequestError(disabledSentryError, { method: "POST" }, {});

    expect(mockedReportServerError).toHaveBeenCalledTimes(2);
    expect(mockedReportServerError).toHaveBeenLastCalledWith(disabledSentryError, {
      event: "next.request_error",
      source: "next-instrumentation",
      request: { method: "POST", routerKind: undefined, routeType: undefined },
    });
  });
});
