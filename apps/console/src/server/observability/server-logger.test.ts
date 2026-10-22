import { AppError } from "@oioi-bwg/server/errors/app-error";
import type { ErrorEvent } from "@sentry/nextjs";
import { DrizzleQueryError } from "drizzle-orm/errors";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sentryMocks = vi.hoisted(() => ({
  captureException: vi.fn<(error: unknown) => string>(() => "safe-event-id"),
  init: vi.fn(),
  setTags: vi.fn<(tags: NonNullable<ErrorEvent["tags"]>) => void>(),
  withScope: vi.fn(),
}));

vi.mock("@sentry/nextjs", () => ({
  captureException: sentryMocks.captureException,
  init: sentryMocks.init,
  withScope: (
    callback: (scope: { setTags: (tags: NonNullable<ErrorEvent["tags"]>) => void }) => void,
  ) => {
    sentryMocks.withScope(callback);
    callback({ setTags: sentryMocks.setTags });
  },
}));

import { sanitizeServerSentryEvent } from "./safe-server-event";
import { logServerError } from "./server-logger";
import { captureServerException } from "./server-sentry-reporter";

const MARKERS = {
  sql: "SELECT_SECRET_MARKER",
  email: "private-email-marker@example.test",
  passwordHash: "PASSWORD_HASH_MARKER",
  otpHash: "OTP_HASH_MARKER",
  ip: "203.0.113.77",
  rawCause: "RAW_CAUSE_MARKER",
  token: "TOKEN_MARKER",
};

function serialized(value: unknown) {
  return JSON.stringify(value);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("independent server logging and Sentry sinks", () => {
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
      logServerError(databaseError, {
        event: "api.unexpected_error",
        source: "api-route-handler",
      }),
    ).toBeUndefined();

    expect(consoleError).toHaveBeenCalledTimes(1);
    const call = consoleError.mock.calls[0];
    expect(call).toHaveLength(1);
    expect(call?.[0]).toEqual(expect.any(String));

    const output = call?.[0] as string;
    expect(output).not.toMatch(/[\r\n]/);
    expect(JSON.parse(output)).toEqual({
      app: "console",
      runtime: "node",
      timestamp: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      level: "error",
      event: "api.unexpected_error",
      source: "api-route-handler",
      error: { type: "database", code: "23505" },
      failure: { kind: "system" },
      handling: "unknown",
      outcome: "unknown",
    });
    for (const marker of Object.values(MARKERS)) expect(output).not.toContain(marker);
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("logs a fixed server operation without serializing the original error", () => {
    vi.stubEnv("NODE_ENV", "development");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logServerError(new Error(MARKERS.token), {
      event: "upload.failure",
      source: "upload-album-image-action",
      operation: "album-image-upload",
      request: { routerKind: "App Router", routeType: "action" },
    });

    const output = consoleError.mock.calls[0]?.[0];
    expect(output).toEqual(expect.any(String));
    expect(output).not.toContain(MARKERS.token);
    expect(JSON.parse(output as string)).toMatchObject({
      event: "upload.failure",
      source: "upload-album-image-action",
      operation: "album-image-upload",
      error: { type: "unknown" },
      request: { routerKind: "App Router", routeType: "action" },
    });
  });

  it("captures the original Error for its frames and sends only typed metadata", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const rawError = new Error(MARKERS.passwordHash, {
      cause: { params: Object.values(MARKERS) },
    });

    expect(
      captureServerException(rawError, {
        event: "api.output_contract_violation",
        source: "api-route-handler",
        error: { type: "output-contract", code: "OUTPUT_CONTRACT_VIOLATION" },
        request: { method: "POST", routerKind: "App Router", routeType: "route" },
      }),
    ).toBe("safe-event-id");

    expect(sentryMocks.captureException).toHaveBeenCalledWith(rawError);
    expect(consoleError).not.toHaveBeenCalled();
    expect(serialized(sentryMocks.setTags.mock.calls)).not.toMatch(
      /SELECT_SECRET_MARKER|private-email-marker|PASSWORD_HASH_MARKER|OTP_HASH_MARKER|RAW_CAUSE_MARKER|TOKEN_MARKER/,
    );
    expect(sentryMocks.setTags).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "api.output_contract_violation",
        source: "api-route-handler",
        "error.type": "output-contract",
        "error.code": "OUTPUT_CONTRACT_VIOLATION",
        "failure.kind": "contract",
        handling: "unknown",
        outcome: "unknown",
        "request.method": "POST",
      }),
    );
    expect(
      sanitizeServerSentryEvent({ type: undefined, tags: sentryMocks.setTags.mock.calls[0]?.[0] })
        .tags,
    ).toMatchObject({ "failure.kind": "contract", "error.code": "OUTPUT_CONTRACT_VIOLATION" });
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
      logServerError(hostile, {
        event: "server.unhandled_error",
        source: "sentry-auto-capture",
      }),
    ).not.toThrow();
    const output = consoleError.mock.calls[0]?.[0];
    expect(output).toEqual(expect.any(String));
    expect(output).not.toMatch(/TOKEN_MARKER|SECRET_MARKER/);
    expect(() => JSON.parse(output as string)).not.toThrow();
  });

  it.each(["STRING_SECRET_MARKER", 42, null])(
    "handles a non-Error value without serializing it",
    (value) => {
      vi.stubEnv("NODE_ENV", "development");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

      expect(() =>
        logServerError(value, {
          event: "server.unhandled_error",
          source: "sentry-auto-capture",
        }),
      ).not.toThrow();
      const output = consoleError.mock.calls[0]?.[0];
      expect(output).toEqual(expect.any(String));
      if (typeof value === "string") expect(output).not.toContain(value);
      expect(JSON.parse(output as string)).toMatchObject({ error: { type: "unknown" } });
    },
  );

  it("normalizes runtime context even when type safety is bypassed", () => {
    vi.stubEnv("NODE_ENV", "development");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);

    logServerError(new Error("ERROR_MARKER"), {
      event: "EVENT_MARKER",
      source: "SOURCE_MARKER",
      handling: "HANDLING_MARKER",
      outcome: "OUTCOME_MARKER",
      request: {
        method: "METHOD_MARKER",
        routerKind: "ROUTER_MARKER",
        routeType: "ROUTE_MARKER",
      },
    } as never);

    const output = consoleError.mock.calls[0]?.[0];
    expect(output).toEqual(expect.any(String));
    expect(output).not.toMatch(
      /ERROR_MARKER|EVENT_MARKER|SOURCE_MARKER|METHOD_MARKER|ROUTER_MARKER|ROUTE_MARKER|HANDLING_MARKER|OUTCOME_MARKER/,
    );
    expect(JSON.parse(output as string)).toMatchObject({
      event: "server.unhandled_error",
      source: "sentry-auto-capture",
      failure: { kind: "unknown" },
      handling: "unknown",
      outcome: "unknown",
    });
  });
});

describe("application failure classification", () => {
  it.each(["UNAUTHENTICATED", "FORBIDDEN"] as const)(
    "retains escaped %s through both sinks and the final sanitizer",
    (code) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const error = new AppError(code, MARKERS);
      const context = {
        event: "next.request_error",
        source: "next-instrumentation",
        request: { routeType: "render" },
        handling: "handled",
        outcome: "response_created",
      } as const;

      logServerError(error, context);
      expect(captureServerException(error, context)).toBe("safe-event-id");
      expect(sentryMocks.captureException.mock.calls[0]?.[0]).toBe(error);
      expect(JSON.parse(consoleError.mock.calls[0]?.[0] as string)).toMatchObject({
        error: { type: "application", code },
        failure: { kind: "delivery" },
        handling: "unhandled",
        outcome: "render_error_captured",
      });

      const frame = { filename: "src/app/admin/page.tsx", lineno: 10, colno: 2 };
      const event = sanitizeServerSentryEvent({
        type: undefined,
        tags: {
          ...sentryMocks.setTags.mock.calls[0]?.[0],
          handling: "handled",
          outcome: "response_created",
          "failure.kind": "system",
        },
        extra: MARKERS,
        exception: { values: [{ type: "AppError", value: code, stacktrace: { frames: [frame] } }] },
      });
      expect(event.tags).toMatchObject({
        "error.type": "application",
        "error.code": code,
        "failure.kind": "delivery",
        handling: "unhandled",
        outcome: "render_error_captured",
      });
      expect(event.exception?.values).toEqual([
        {
          type: "DeliveryError",
          value: "Unhandled application delivery failure",
          stacktrace: { frames: [frame] },
        },
      ]);
      for (const marker of Object.values(MARKERS)) {
        expect(serialized([event, consoleError.mock.calls])).not.toContain(marker);
      }
    },
  );

  it.each(["UNAUTHENTICATED", "FORBIDDEN", "SONG_NOT_FOUND", "SONG_SLUG_ALREADY_EXISTS"] as const)(
    "excludes a handled %s from both error sinks",
    (code) => {
      vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
      vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
      const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
      const error = new AppError(code, MARKERS);
      const context = {
        event: "api.unexpected_error",
        source: "api-route-handler",
        handling: "handled",
        outcome: "response_created",
      } as const;

      logServerError(error, context);
      expect(captureServerException(error, context)).toBeNull();
      expect(consoleError).not.toHaveBeenCalled();
      expect(sentryMocks.captureException).not.toHaveBeenCalled();
    },
  );

  it.each([
    Object.assign(new Error("UNAUTHENTICATED", { cause: new AppError("FORBIDDEN") }), {
      name: "AppError",
      code: "UNAUTHENTICATED",
    }),
    Object.assign(new AppError("UNAUTHENTICATED"), { code: MARKERS.token }),
  ])("does not infer an application error from invalid or unavailable identity", (error) => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "staging");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");
    captureServerException(error, {
      event: "next.request_error",
      source: "next-instrumentation",
      request: { routeType: "render" },
    });
    expect(sentryMocks.captureException.mock.calls[0]?.[0]).toBe(error);
    expect(sentryMocks.setTags).toHaveBeenCalledWith(
      expect.objectContaining({
        "error.type": "unknown",
        "failure.kind": "unknown",
        handling: "unhandled",
        outcome: "render_error_captured",
      }),
    );
    expect(sentryMocks.setTags.mock.calls[0]?.[0]).not.toHaveProperty("error.code");
  });

  it("keeps render failure classification in the actual hook log when Sentry is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "local");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "");
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { onRequestError } = await import("../../instrumentation");
    await onRequestError(
      new AppError("UNAUTHENTICATED", MARKERS),
      { method: "GET" },
      { routeType: "render" },
    );
    expect(JSON.parse(consoleError.mock.calls[0]?.[0] as string)).toMatchObject({
      event: "next.request_error",
      error: { type: "application", code: "UNAUTHENTICATED" },
      failure: { kind: "delivery" },
      handling: "unhandled",
      outcome: "render_error_captured",
    });
    expect(sentryMocks.captureException).not.toHaveBeenCalled();
  });

  it("normalizes a non-Error throw before Sentry capture", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_ENV", "production");
    vi.stubEnv("NEXT_PUBLIC_SENTRY_DSN", "https://public@example.test/1");

    captureServerException("STRING_SECRET_MARKER", {
      event: "server.unhandled_error",
      source: "sentry-auto-capture",
    });

    const captured = sentryMocks.captureException.mock.calls[0]?.[0];
    expect(captured).toBeInstanceOf(Error);
    expect((captured as Error).message).toBe("Unexpected server error");
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
      release: `oioi-bwg@${"b".repeat(40)}`,
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            code_file: "file:///app/.next/server/chunks/app.js",
            debug_id: "12345678-1234-4abc-8def-1234567890ab",
          },
          {
            type: "sourcemap",
            code_file: `/private/${MARKERS.email}`,
            debug_id: MARKERS.token,
          },
        ],
      },
      message: MARKERS.sql,
      logentry: { message: MARKERS.passwordHash, params: [MARKERS.otpHash] },
      exception: {
        values: [
          {
            type: "DrizzleQueryError",
            value: `${MARKERS.sql} params ${MARKERS.email}`,
            mechanism: { data: { cause: MARKERS.rawCause, token: MARKERS.token } },
            stacktrace: {
              frames: [
                {
                  filename: "src/server/services/signup-service.ts",
                  function: "completeSignup",
                  lineno: 42,
                  colno: 11,
                  abs_path: `/private/${MARKERS.email}`,
                  context_line: `${MARKERS.sql} ${MARKERS.passwordHash}`,
                  pre_context: [MARKERS.otpHash],
                  post_context: [MARKERS.ip],
                  vars: { cause: MARKERS.rawCause, params: Object.values(MARKERS) },
                  module: MARKERS.passwordHash,
                },
                {
                  filename: "src/server/http/api-response.ts",
                  function: "toErrorResponse",
                  lineno: 107,
                  colno: 3,
                  context_line: MARKERS.token,
                  vars: { email: MARKERS.email },
                },
              ],
            },
          },
        ],
      },
      request: {
        url: `https://example.test/private?email=${MARKERS.email}`,
        headers: { cookie: MARKERS.token, authorization: MARKERS.passwordHash },
        data: MARKERS.otpHash,
      },
      user: { email: MARKERS.email, ip_address: MARKERS.ip },
      extra: { params: Object.values(MARKERS) },
      breadcrumbs: [{ message: MARKERS.token, data: { otp: MARKERS.otpHash } }],
      tags: {
        app: "console",
        runtime: "node",
        event: "api.unexpected_error",
        source: "api-route-handler",
        "error.type": "database",
        "error.code": "23505",
        "failure.kind": "delivery",
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
      release: `oioi-bwg@${"b".repeat(40)}`,
      debug_meta: {
        images: [
          {
            type: "sourcemap",
            code_file: ".next/server/chunks/app.js",
            debug_id: "12345678-1234-4abc-8def-1234567890ab",
          },
        ],
      },
      exception: {
        values: [
          {
            type: "DatabaseError",
            value: "Unexpected server error",
            stacktrace: {
              frames: [
                {
                  filename: "src/server/services/signup-service.ts",
                  function: "completeSignup",
                  lineno: 42,
                  colno: 11,
                },
                {
                  filename: "src/server/http/api-response.ts",
                  function: "toErrorResponse",
                  lineno: 107,
                  colno: 3,
                },
              ],
            },
          },
        ],
      },
      tags: {
        app: "console",
        runtime: "node",
        event: "api.unexpected_error",
        source: "api-route-handler",
        "error.type": "database",
        "error.code": "23505",
        "failure.kind": "system",
        handling: "unknown",
        outcome: "unknown",
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
      app: "console",
      runtime: "node",
      event: "server.unhandled_error",
      source: "sentry-auto-capture",
      "error.type": "unknown",
      "failure.kind": "unknown",
      handling: "unknown",
      outcome: "unknown",
    });
  });

  it("retains typed upload classification without retaining storage error details", () => {
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
      extra: { params: [MARKERS.passwordHash] },
      tags: {
        event: "upload.failure",
        source: "upload-album-image-action",
        operation: "album-image-upload",
        "error.type": "unknown",
      },
    });

    expect(serialized(safeEvent)).not.toMatch(/TOKEN_MARKER|PASSWORD_HASH_MARKER/);
    expect(safeEvent.tags).toEqual({
      app: "console",
      runtime: "node",
      event: "upload.failure",
      source: "upload-album-image-action",
      operation: "album-image-upload",
      "error.type": "unknown",
      "failure.kind": "unknown",
      handling: "unknown",
      outcome: "unknown",
    });
  });

  it("rejects unknown classification, application code and outcome tags", () => {
    const event = sanitizeServerSentryEvent({
      type: undefined,
      tags: {
        "error.type": "application",
        "error.code": MARKERS.token,
        "failure.kind": "delivery",
        handling: MARKERS.email,
        outcome: MARKERS.passwordHash,
      },
    });
    expect(event.tags).toMatchObject({
      "error.type": "unknown",
      "failure.kind": "unknown",
      handling: "unknown",
      outcome: "unknown",
    });
    expect(event.tags).not.toHaveProperty("error.code");
    for (const marker of Object.values(MARKERS)) expect(serialized(event)).not.toContain(marker);
  });
});
