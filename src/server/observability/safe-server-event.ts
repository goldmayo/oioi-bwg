import "server-only";

import type { ErrorEvent } from "@sentry/nextjs";
import { DrizzleQueryError } from "drizzle-orm/errors";

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

export const SAFE_ERROR_TYPES = ["auth", "database", "output-contract", "unknown"] as const;

const SAFE_LEVELS = ["fatal", "error", "warning", "log", "info", "debug"] as const;
const SAFE_ENVIRONMENTS = ["development", "staging", "production", "test"] as const;
const SAFE_METHODS = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"] as const;
const SAFE_ROUTER_KINDS = ["App Router", "Pages Router"] as const;
const SAFE_ROUTE_TYPES = ["action", "proxy", "render", "route"] as const;

export type ServerErrorEvent = (typeof SERVER_ERROR_EVENTS)[number];
export type ServerErrorSource = (typeof SERVER_ERROR_SOURCES)[number];
export type SafeErrorType = (typeof SAFE_ERROR_TYPES)[number];
export type SafeMethod = (typeof SAFE_METHODS)[number];
export type SafeRouterKind = (typeof SAFE_ROUTER_KINDS)[number];
export type SafeRouteType = (typeof SAFE_ROUTE_TYPES)[number];

export interface SafeRequestMetadata {
  method?: SafeMethod;
  routerKind?: SafeRouterKind;
  routeType?: SafeRouteType;
}

export interface SafeErrorDescriptor {
  type: SafeErrorType;
  code?: string;
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
  const code = isSafeCode(preferred?.code) ? preferred.code : findSafeCode(error);
  const type = isOneOf(preferred?.type, SAFE_ERROR_TYPES)
    ? preferred.type
    : code && /^[0-9A-Z]{5}$/.test(code)
      ? "database"
      : "unknown";

  return code ? { type, code } : { type };
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

function isAlbumImageUploadError(event: ErrorEvent) {
  const values = readProperty(event.exception, "values");
  if (!Array.isArray(values)) return false;

  return values.some((value) => readProperty(value, "type") === "AlbumImageUploadError");
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

/** Sentry가 보강한 event도 전송 직전에 안전한 field만 남긴다. */
export function sanitizeServerSentryEvent(event: ErrorEvent): ErrorEvent {
  const eventTag = safeTag(event, "event");
  const sourceTag = safeTag(event, "source");
  const errorTypeTag = safeTag(event, "error.type");
  const isUploadError = isAlbumImageUploadError(event);
  const eventName = isUploadError ? "upload.failure" : toSafeServerErrorEvent(eventTag);
  const source = isUploadError ? "upload-album-image-action" : toSafeServerErrorSource(sourceTag);
  const errorType = isOneOf(errorTypeTag, SAFE_ERROR_TYPES) ? errorTypeTag : "unknown";
  const errorCode = safeTag(event, "error.code");
  const method = safeTag(event, "request.method");
  const routerKind = safeTag(event, "next.router_kind");
  const routeType = safeTag(event, "next.route_type");
  const trace = safeTraceContext(event);

  const tags = {
    event: eventName,
    source,
    "error.type": errorType,
    ...(isSafeCode(errorCode) ? { "error.code": errorCode } : {}),
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
    exception: {
      values: [
        {
          type:
            errorType === "auth"
              ? "AuthError"
              : errorType === "database"
                ? "DatabaseError"
                : errorType === "output-contract"
                  ? "OutputContractError"
                  : "UnknownError",
          value: "Unexpected server error",
        },
      ],
    },
    tags,
    ...(trace ? { contexts: { trace } } : {}),
  };
}
