import "server-only";

import { appErrorCodeSchema } from "@oioi-bwg/contracts/error";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import type { ErrorEvent } from "@sentry/nextjs";
import { DrizzleQueryError } from "drizzle-orm/errors";

import {
  toSafeSentryBuildMetadata,
  toSafeSentryBuildPath,
} from "@/shared/lib/sentry-build-metadata";
import { getSentryRouteMetadata, SENTRY_OPERATIONS } from "@/shared/lib/sentry-route-metadata";

export const SERVER_ERROR_EVENTS = [
  "api.unexpected_error",
  "api.output_contract_violation",
  "auth.failure",
  "next.request_error",
  "server.unhandled_error",
  "upload.failure",
] as const;

export const SERVER_ERROR_SOURCES = [
  "api-route-handler",
  "auth-js",
  "next-instrumentation",
  "sentry-auto-capture",
  "upload-album-image-action",
] as const;

export { SENTRY_OPERATIONS as SERVER_OPERATIONS } from "@/shared/lib/sentry-route-metadata";

export const SAFE_ERROR_TYPES = [
  "application",
  "auth",
  "database",
  "output-contract",
  "unknown",
] as const;
const ERROR_HANDLINGS = ["handled", "unhandled", "unknown"] as const;
const ERROR_OUTCOMES = [
  "response_created",
  "login_redirect_requested",
  "access_denied_requested",
  "action_rejection_returned",
  "render_error_captured",
  "error_boundary_mounted",
  "unknown",
] as const;

const SAFE_LEVELS = ["fatal", "error", "warning", "log", "info", "debug"] as const;
const SAFE_ENVIRONMENTS = ["development", "staging", "production", "test"] as const;
const SAFE_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] as const;
const SAFE_ROUTER_KINDS = ["App Router", "Pages Router"] as const;
const SAFE_ROUTE_TYPES = ["action", "proxy", "render", "route"] as const;

export type ServerErrorEvent = (typeof SERVER_ERROR_EVENTS)[number];
export type ServerErrorSource = (typeof SERVER_ERROR_SOURCES)[number];
export type ServerOperation = (typeof SENTRY_OPERATIONS)[number];
export type SafeErrorType = (typeof SAFE_ERROR_TYPES)[number];
export type SafeMethod = (typeof SAFE_METHODS)[number];
export type SafeRouterKind = (typeof SAFE_ROUTER_KINDS)[number];
export type SafeRouteType = (typeof SAFE_ROUTE_TYPES)[number];

const EXCEPTION_NAMES: Record<SafeErrorType, string> = {
  application: "ApplicationError",
  auth: "AuthError",
  database: "DatabaseError",
  "output-contract": "OutputContractError",
  unknown: "UnknownError",
};

export interface SafeRequestMetadata {
  method?: SafeMethod;
  routerKind?: SafeRouterKind;
  routeType?: SafeRouteType;
}

export interface SafeErrorDescriptor {
  type: SafeErrorType;
  code?: string;
}

export interface ServerErrorContext {
  event: ServerErrorEvent;
  source: ServerErrorSource;
  operation?: ServerOperation;
  route?: string;
  error?: Partial<SafeErrorDescriptor>;
  request?: SafeRequestMetadata;
  handling?: (typeof ERROR_HANDLINGS)[number];
  outcome?: (typeof ERROR_OUTCOMES)[number];
}

export interface SafeFailureMetadata {
  kind: "contract" | "delivery" | "system" | "unknown";
  handling: (typeof ERROR_HANDLINGS)[number];
  outcome: (typeof ERROR_OUTCOMES)[number];
}

function isOneOf<const T extends readonly string[]>(value: unknown, values: T): value is T[number] {
  return typeof value === "string" && values.some((candidate) => candidate === value);
}

function readProperty(value: unknown, key: PropertyKey): unknown {
  if ((typeof value !== "object" && typeof value !== "function") || value === null)
    return undefined;

  try {
    return Reflect.get(value, key);
  } catch {
    return undefined;
  }
}

function isSafeCode(value: unknown): value is string {
  return (
    value === "AUTH_FAILURE" ||
    value === "OUTPUT_CONTRACT_VIOLATION" ||
    (typeof value === "string" && /^[0-9A-Z]{5}$/.test(value))
  );
}

function isAppError(error: unknown): error is AppError {
  try {
    return error instanceof AppError;
  } catch {
    return false;
  }
}

function isDrizzleQueryError(error: unknown): error is DrizzleQueryError {
  try {
    return error instanceof DrizzleQueryError;
  } catch {
    return false;
  }
}

function findSafeCode(error: unknown): string | undefined {
  if (!isDrizzleQueryError(error)) return undefined;

  const causeCode = readProperty(readProperty(error, "cause"), "code");
  return isSafeCode(causeCode) ? causeCode : undefined;
}

export function describeServerError(
  error: unknown,
  preferred?: Partial<SafeErrorDescriptor>,
): SafeErrorDescriptor {
  if (isAppError(error)) {
    const code = readProperty(error, "code");
    return isOneOf(code, appErrorCodeSchema.options)
      ? { type: "application", code }
      : { type: "unknown" };
  }
  const code = isSafeCode(preferred?.code) ? preferred.code : findSafeCode(error);
  const type =
    preferred?.type !== "application" && isOneOf(preferred?.type, SAFE_ERROR_TYPES)
      ? preferred.type
      : code && /^[0-9A-Z]{5}$/.test(code)
        ? "database"
        : "unknown";

  return code ? { type, code } : { type };
}

/** A render error hook observes an escaped exception, not a final HTTP/UI outcome. */
export function describeServerFailure(
  descriptor: SafeErrorDescriptor,
  context: ServerErrorContext,
): SafeFailureMetadata {
  const renderError =
    context.event === "next.request_error" &&
    context.source === "next-instrumentation" &&
    readProperty(context.request, "routeType") === "render";
  const handling = readProperty(context, "handling");
  const outcome = readProperty(context, "outcome");
  return {
    kind:
      descriptor.type === "output-contract"
        ? "contract"
        : descriptor.type === "application" && renderError
          ? "delivery"
          : descriptor.type === "database" || descriptor.type === "auth"
            ? "system"
            : "unknown",
    handling: renderError ? "unhandled" : isOneOf(handling, ERROR_HANDLINGS) ? handling : "unknown",
    outcome: renderError
      ? "render_error_captured"
      : isOneOf(outcome, ERROR_OUTCOMES)
        ? outcome
        : "unknown",
  };
}

export function toSafeMethod(value: unknown): SafeMethod | undefined {
  return isOneOf(value, SAFE_METHODS) ? value : undefined;
}

export function toSafeServerErrorEvent(value: unknown): ServerErrorEvent {
  return isOneOf(value, SERVER_ERROR_EVENTS) ? value : "server.unhandled_error";
}

export function toSafeServerErrorSource(value: unknown): ServerErrorSource {
  return isOneOf(value, SERVER_ERROR_SOURCES) ? value : "sentry-auto-capture";
}

export function toSafeServerOperation(value: unknown): ServerOperation | undefined {
  return isOneOf(value, SENTRY_OPERATIONS) ? value : undefined;
}

export function toSafeRequestMetadata(value: unknown): SafeRequestMetadata | undefined {
  const method = toSafeMethod(readProperty(value, "method"));
  const routerKind = toSafeRouterKind(readProperty(value, "routerKind"));
  const routeType = toSafeRouteType(readProperty(value, "routeType"));

  return method || routerKind || routeType ? { method, routerKind, routeType } : undefined;
}

export function toSafeRouterKind(value: unknown): SafeRouterKind | undefined {
  return isOneOf(value, SAFE_ROUTER_KINDS) ? value : undefined;
}

export function toSafeRouteType(value: unknown): SafeRouteType | undefined {
  return isOneOf(value, SAFE_ROUTE_TYPES) ? value : undefined;
}

function safeTag(event: ErrorEvent, key: string): unknown {
  return readProperty(event.tags, key);
}

function safeTraceContext(event: ErrorEvent) {
  const trace = readProperty(event.contexts, "trace");
  const traceId = readProperty(trace, "trace_id");
  const spanId = readProperty(trace, "span_id");
  const parentSpanId = readProperty(trace, "parent_span_id");

  if (
    typeof traceId !== "string" ||
    !/^[0-9a-f]{32}$/i.test(traceId) ||
    typeof spanId !== "string" ||
    !/^[0-9a-f]{16}$/i.test(spanId)
  ) {
    return undefined;
  }

  return {
    trace_id: traceId,
    span_id: spanId,
    ...(typeof parentSpanId === "string" && /^[0-9a-f]{16}$/i.test(parentSpanId)
      ? { parent_span_id: parentSpanId }
      : {}),
  };
}

function safeStackText(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !/[\r\n]/.test(value)
    ? value
    : undefined;
}

function safeStackNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function safeStacktrace(event: ErrorEvent) {
  const values = readProperty(readProperty(event, "exception"), "values");
  if (!Array.isArray(values) || values.length === 0) return undefined;

  const stacktrace = readProperty(values[values.length - 1], "stacktrace");
  const frames = readProperty(stacktrace, "frames");
  if (!Array.isArray(frames)) return undefined;

  const safeFrames = frames.flatMap((frame) => {
    const filename = safeStackText(readProperty(frame, "filename"));
    const absPath =
      toSafeSentryBuildPath(readProperty(frame, "abs_path")) ??
      toSafeSentryBuildPath(readProperty(frame, "filename"));
    const functionName = safeStackText(readProperty(frame, "function"));
    const lineno = safeStackNumber(readProperty(frame, "lineno"));
    const colno = safeStackNumber(readProperty(frame, "colno"));

    if (!filename && !functionName && lineno === undefined && colno === undefined) return [];

    return [
      {
        ...(filename ? { filename } : {}),
        ...(absPath ? { abs_path: absPath } : {}),
        ...(functionName ? { function: functionName } : {}),
        ...(lineno !== undefined ? { lineno } : {}),
        ...(colno !== undefined ? { colno } : {}),
      },
    ];
  });

  return safeFrames.length > 0 ? { frames: safeFrames } : undefined;
}

/** Sentry가 보강한 event도 전송 직전에 안전한 field만 남긴다. */
export function sanitizeServerSentryEvent(event: ErrorEvent): ErrorEvent {
  const eventTag = safeTag(event, "event");
  const sourceTag = safeTag(event, "source");
  const errorTypeTag = safeTag(event, "error.type");
  const eventName = toSafeServerErrorEvent(eventTag);
  const source = toSafeServerErrorSource(sourceTag);
  const route = getSentryRouteMetadata(safeTag(event, "route.template"));
  const operation = toSafeServerOperation(safeTag(event, "operation")) ?? route?.operation;
  const errorCode = safeTag(event, "error.code");
  const errorType =
    errorTypeTag === "application" && !isOneOf(errorCode, appErrorCodeSchema.options)
      ? "unknown"
      : isOneOf(errorTypeTag, SAFE_ERROR_TYPES)
        ? errorTypeTag
        : "unknown";
  const method = safeTag(event, "request.method");
  const routerKind = safeTag(event, "next.router_kind");
  const routeType = safeTag(event, "next.route_type");
  const handling = safeTag(event, "handling");
  const outcome = safeTag(event, "outcome");
  const failure = describeServerFailure(
    { type: errorType },
    {
      event: eventName,
      source,
      request: toSafeRequestMetadata({ method, routerKind, routeType }),
      ...(isOneOf(handling, ERROR_HANDLINGS) ? { handling } : {}),
      ...(isOneOf(outcome, ERROR_OUTCOMES) ? { outcome } : {}),
    },
  );
  const trace = safeTraceContext(event);
  const stacktrace = safeStacktrace(event);

  const tags = {
    app: "web",
    runtime: "node",
    ...(route ? { "route.template": route.template } : {}),
    event: eventName,
    source,
    ...(operation ? { operation } : {}),
    "error.type": errorType,
    "failure.kind": failure.kind,
    handling: failure.handling,
    outcome: failure.outcome,
    ...(isSafeCode(errorCode) ||
    (errorType === "application" && isOneOf(errorCode, appErrorCodeSchema.options))
      ? { "error.code": errorCode }
      : {}),
    ...(isOneOf(method, SAFE_METHODS) ? { "request.method": method } : {}),
    ...(isOneOf(routerKind, SAFE_ROUTER_KINDS) ? { "next.router_kind": routerKind } : {}),
    ...(isOneOf(routeType, SAFE_ROUTE_TYPES) ? { "next.route_type": routeType } : {}),
  };

  return {
    type: undefined,
    ...(typeof event.event_id === "string" && /^[0-9a-f]{32}$/i.test(event.event_id)
      ? { event_id: event.event_id }
      : {}),
    ...(typeof event.timestamp === "number" ? { timestamp: event.timestamp } : {}),
    ...(isOneOf(event.level, SAFE_LEVELS) ? { level: event.level } : { level: "error" }),
    platform: "node",
    ...(isOneOf(event.environment, SAFE_ENVIRONMENTS) ? { environment: event.environment } : {}),
    ...toSafeSentryBuildMetadata(event),
    exception: {
      values: [
        {
          type: failure.kind === "delivery" ? "DeliveryError" : EXCEPTION_NAMES[errorType],
          value:
            failure.kind === "delivery"
              ? "Unhandled application delivery failure"
              : "Unexpected server error",
          ...(stacktrace ? { stacktrace } : {}),
        },
      ],
    },
    tags,
    ...(trace ? { contexts: { trace } } : {}),
  };
}
