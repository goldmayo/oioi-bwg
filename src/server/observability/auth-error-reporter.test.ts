import { beforeEach, describe, expect, it, vi } from "vitest";

import { reportAuthError } from "./auth-error-reporter";
import { reportServerError } from "./server-logger";

vi.mock("./server-logger", () => ({ reportServerError: vi.fn() }));

const mockedReportServerError = vi.mocked(reportServerError);

describe("reportAuthError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not capture a normal credentials rejection", () => {
    reportAuthError(
      Object.assign(new Error("credentials rejected"), { type: "CredentialsSignin" }),
    );

    expect(mockedReportServerError).not.toHaveBeenCalled();
  });

  it("classifies an unexpected Auth.js failure without forwarding its cause as metadata", () => {
    const error = Object.assign(new Error("auth wrapper"), {
      type: "CallbackRouteError",
      cause: {
        err: new Error("SQL_MARKER", {
          cause: { params: ["EMAIL_MARKER", "PASSWORD_HASH_MARKER"] },
        }),
      },
    });

    reportAuthError(error);

    expect(mockedReportServerError).toHaveBeenCalledWith(error, {
      event: "auth.failure",
      source: "auth-js",
      error: { type: "auth", code: "AUTH_FAILURE" },
    });
    expect(JSON.stringify(mockedReportServerError.mock.calls[0]?.[1])).not.toMatch(
      /SQL_MARKER|EMAIL_MARKER|PASSWORD_HASH_MARKER/,
    );
  });
});
