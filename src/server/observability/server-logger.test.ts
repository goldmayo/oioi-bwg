import type { ErrorEvent } from "@sentry/nextjs";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn(() => "safe-event-id"),
  init: vi.fn(),
  setTags: vi.fn(),
  withScope: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: sentryMocks.captureException,
  init: sentryMocks.init,
  withScope: (callback: (scope: { setTags: (tags: Record<string, unknown>) => void }) => void) => {
    sentryMocks.withScope(callback);
    callback({ setTags: sentryMocks.setTags });
  },
}));

import { sanitizeServerSentryEvent } from "./safe-server-event";
import { reportServerError } from "./server-logger";

const MARKERS = {
  sql: "SELECT_SECRET_MARKER",
  email: "private-email-marker@example.test",
  passwordHash: "PASSWORD_HASH_MARKER",
  otpHash: "OTP_HASH_MARKER",
  token: "TOKEN_MARKER",
};

function serialized(value: unknown) {
  return JSON.stringify(value);
}

describe("reportServerError", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("logs only an allowlisted descriptor for a nested database error", () => {
    vi.stubEnv("NODE_ENV", "development");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const databaseError = new DrizzleQueryError(
      `${MARKERS.sql} ${MARKERS.email}`,
      [MARKERS.email, MARKERS.passwordHash, MARKERS.otpHash, MARKERS.token],
      Object.assign(new Error(MARKERS.passwordHash), {
        code: "23505",
        params: [MARKERS.email, MARKERS.passwordHash, MARKERS.otpHash, MARKERS.token],
      }),
    );

    expect(
      reportServerError(databaseError, {
        event: "api.unexpected_error",
        source: "api-route-handler",
      }),
    ).toBeNull();

    const output = serialized(consoleError.mock.calls);
    for (const marker of Object.values(MARKERS)) expect(output).not.toContain(marker);
    expect(output).toContain('"event":"api.unexpected_error"');
    expect(output).toContain('"type":"database"');
    expect(output).toContain('"code":"23505"');
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("captures a newly-created safe exception and typed metadata", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rawError = new Error(MARKERS.passwordHash, {
      cause: { params: Object.values(MARKERS) },
    });

    expect(
      reportServerError(rawError, {
        event: "api.output_contract_violation",
        source: "api-route-handler",
        error: { type: "output-contract", code: "OUTPUT_CONTRACT_VIOLATION" },
        request: { method: "POST", routerKind: "App Router", routeType: "route" },
      }),
    ).toBe("safe-event-id");

    const capturePayload = serialized([
      sentryMocks.captureException.mock.calls,
      sentryMocks.setTags.mock.calls,
    ]);
    for (const marker of Object.values(MARKERS)) expect(capturePayload).not.toContain(marker);
    expect(sentryMocks.captureException).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "OutputContractError",
        message: "Unexpected server error",
      }),
    );
    expect(sentryMocks.setTags).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "api.output_contract_violation",
        source: "api-route-handler",
        "error.type": "output-contract",
        "error.code": "OUTPUT_CONTRACT_VIOLATION",
        "request.method": "POST",
      }),
    );
  });

  it("does not inspect hostile getters beyond the safe bounded fields", () => {
    vi.stubEnv("NODE_ENV", "development");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const hostile = new Proxy(
      {},
      {
        get(_target, property) {
          if (property === "code") return "TOKEN_MARKER";
          throw new Error("GETTER_SECRET_MARKER");
        },
        getPrototypeOf() {
          throw new Error("PROTOTYPE_SECRET_MARKER");
        },
      },
    );

    expect(() =>
      reportServerError(hostile, {
        event: "server.unhandled_error",
        source: "sentry-auto-capture",
      }),
    ).not.toThrow();
    expect(serialized(consoleError.mock.calls)).not.toMatch(/TOKEN_MARKER|SECRET_MARKER/);
  });

  it.each(["STRING_SECRET_MARKER", 42, null])(
    "handles a non-Error value without serializing it",
    (value) => {
      vi.stubEnv("NODE_ENV", "development");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      expect(() =>
        reportServerError(value, {
          event: "server.unhandled_error",
          source: "sentry-auto-capture",
        }),
      ).not.toThrow();
      const output = serialized(consoleError.mock.calls);
      if (typeof value === "string") expect(output).not.toContain(value);
      expect(output).toContain('"type":"unknown"');
    },
  );

  it("normalizes runtime context even when type safety is bypassed", () => {
    vi.stubEnv("NODE_ENV", "development");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    reportServerError(new Error("ERROR_MARKER"), {
      event: "EVENT_MARKER",
      source: "SOURCE_MARKER",
      request: {
        method: "METHOD_MARKER",
        routerKind: "ROUTER_MARKER",
        routeType: "ROUTE_MARKER",
      },
    } as never);

    const output = serialized(consoleError.mock.calls);
    expect(output).not.toMatch(
      /ERROR_MARKER|EVENT_MARKER|SOURCE_MARKER|METHOD_MARKER|ROUTER_MARKER|ROUTE_MARKER/,
    );
    expect(output).toContain('"event":"server.unhandled_error"');
    expect(output).toContain('"source":"sentry-auto-capture"');
  });
});

describe("sanitizeServerSentryEvent", () => {
  it("is registered as the fail-closed server beforeSend boundary", async () => {
    await import("../../../sentry.server.config");

    expect(sentryMocks.init).toHaveBeenCalledWith(
      expect.objectContaining({
        sendDefaultPii: false,
        beforeSend: sanitizeServerSentryEvent,
      }),
    );
  });

  it("drops raw exception, message, request, user, extras and breadcrumb data", () => {
    const rawEvent = {
      type: undefined,
      event_id: "a".repeat(32),
      timestamp: 123,
      level: "error",
      environment: "staging",
      message: MARKERS.sql,
      logentry: { message: MARKERS.passwordHash, params: [MARKERS.otpHash] },
      exception: {
        values: [
          {
            type: "DrizzleQueryError",
            value: `${MARKERS.sql} params ${MARKERS.email}`,
            mechanism: { data: { token: MARKERS.token } },
          },
        ],
      },
      request: {
        url: `https://example.test/private?email=${MARKERS.email}`,
        headers: { cookie: MARKERS.token, authorization: MARKERS.passwordHash },
        data: MARKERS.otpHash,
      },
      user: { email: MARKERS.email, ip_address: "203.0.113.77" },
      extra: { params: Object.values(MARKERS) },
      breadcrumbs: [{ message: MARKERS.token, data: { otp: MARKERS.otpHash } }],
      tags: {
        event: "api.unexpected_error",
        source: "api-route-handler",
        "error.type": "database",
        "error.code": "23505",
        "request.method": "POST",
        unsafe: MARKERS.email,
      },
      contexts: {
        trace: { trace_id: "b".repeat(32), span_id: "c".repeat(16), data: MARKERS.token },
        unsafe: { password: MARKERS.passwordHash },
      },
    } as unknown as ErrorEvent;

    const safeEvent = sanitizeServerSentryEvent(rawEvent);
    const output = serialized(safeEvent);

    for (const marker of Object.values(MARKERS)) expect(output).not.toContain(marker);
    expect(safeEvent).toEqual({
      type: undefined,
      event_id: "a".repeat(32),
      timestamp: 123,
      level: "error",
      platform: "node",
      environment: "staging",
      exception: {
        values: [{ type: "DatabaseError", value: "Unexpected server error" }],
      },
      tags: {
        event: "api.unexpected_error",
        source: "api-route-handler",
        "error.type": "database",
        "error.code": "23505",
        "request.method": "POST",
      },
      contexts: { trace: { trace_id: "b".repeat(32), span_id: "c".repeat(16) } },
    });
  });

  it("uses safe fallbacks for an unclassified captureMessage event", () => {
    const safeEvent = sanitizeServerSentryEvent({
      type: undefined,
      message: MARKERS.token,
      extra: { authorization: MARKERS.passwordHash },
    });

    expect(serialized(safeEvent)).not.toMatch(/TOKEN_MARKER|PASSWORD_HASH_MARKER/);
    expect(safeEvent.tags).toEqual({
      event: "server.unhandled_error",
      source: "sentry-auto-capture",
      "error.type": "unknown",
    });
  });

  it("retains the fixed upload source without retaining storage error details", () => {
    const safeEvent = sanitizeServerSentryEvent({
      type: undefined,
      exception: {
        values: [
          {
            type: "AlbumImageUploadError",
            value: `storage failed ${MARKERS.token}`,
          },
        ],
      },
      extra: { source: "upload-album-image-action", params: [MARKERS.passwordHash] },
    });

    expect(serialized(safeEvent)).not.toMatch(/TOKEN_MARKER|PASSWORD_HASH_MARKER/);
    expect(safeEvent.tags).toEqual({
      event: "upload.failure",
      source: "upload-album-image-action",
      "error.type": "unknown",
    });
  });
});
