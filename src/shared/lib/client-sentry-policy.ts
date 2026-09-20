import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

import { toSafeSentryBuildMetadata, toSafeSentryBuildPath } from "./sentry-build-metadata";

export const SENTRY_ERROR_SOURCES = [
  "admin-error-boundary",
  "admin-login-form",
  "global-error-boundary",
  "mutation-cache",
  "query-cache",
  "sentry-auto-capture",
  "upload-album-image-action",
] as const;

const CLIENT_ERROR_TYPES = ["client-contract", "client-transport", "runtime"] as const;
const SAFE_LEVELS = ["fatal", "error", "warning", "log", "info", "debug"] as const;
const SAFE_ENVIRONMENTS = ["staging", "production"] as const;
const SAFE_EXCEPTION_TYPES = [
  "Error",
  "EvalError",
  "RangeError",
  "ReferenceError",
  "SyntaxError",
  "TypeError",
  "URIError",
  "ClientContractError",
  "ClientTransportError",
] as const;
const SAFE_BROWSER_NAMES = [
  "Chrome",
  "Chrome Mobile",
  "Edge",
  "Firefox",
  "Firefox Mobile",
  "Mobile Safari",
  "Opera",
  "Safari",
] as const;
const SAFE_OS_NAMES = ["Android", "Chrome OS", "iOS", "Linux", "Mac OS X", "Windows"] as const;
const SAFE_RUNTIME_MEMBER_NAMES = new Set([
  "filter",
  "find",
  "forEach",
  "id",
  "length",
  "map",
  "reduce",
  "then",
  "toString",
  "trim",
  "value",
]);
const SAFE_TYPE_ERROR_MESSAGES = new Set([
  "Cannot convert undefined or null to object",
  "Failed to fetch",
  "Load failed",
  "NetworkError when attempting to fetch resource.",
]);
const SAFE_RANGE_ERROR_MESSAGES = new Set([
  "Invalid array length",
  "Invalid string length",
  "Maximum call stack size exceeded",
]);

export type SentryErrorSource = (typeof SENTRY_ERROR_SOURCES)[number];
export type ClientErrorType = (typeof CLIENT_ERROR_TYPES)[number];

export interface SentryErrorContext {
  source: SentryErrorSource;
  digest?: string;
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

function safeDigest(value: unknown): string | undefined {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) ? value : undefined;
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

function stripUrlDetails(value: unknown): string | undefined {
  const text = safeStackText(value);
  if (!text) return undefined;

  return text.split(/[?#]/, 1)[0];
}

function safeStackFilename(value: unknown): string | undefined {
  const filename = stripUrlDetails(value);
  if (!filename) return undefined;

  if (/^https?:\/\//.test(filename)) {
    try {
      const url = new URL(filename);
      return url.pathname.includes("/_next/") ? url.pathname : undefined;
    } catch {
      return undefined;
    }
  }

  return /^(?:\/?_next\/|src\/|\.\.?\/|webpack-internal:\/\/\/|turbopack:\/\/\/|<anonymous>$)/.test(
    filename,
  )
    ? filename
    : undefined;
}

function safeStacktrace(event: ErrorEvent) {
  const values = readProperty(readProperty(event, "exception"), "values");
  if (!Array.isArray(values) || values.length === 0) return undefined;

  const stacktrace = readProperty(values[values.length - 1], "stacktrace");
  const frames = readProperty(stacktrace, "frames");
  if (!Array.isArray(frames)) return undefined;

  const safeFrames = frames.flatMap((frame) => {
    const filename = safeStackFilename(readProperty(frame, "filename"));
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

function safeContext(value: unknown, safeNames: readonly string[]) {
  const rawName = readProperty(value, "name");
  const rawVersion = readProperty(value, "version");
  const name = isOneOf(rawName, safeNames) ? rawName : undefined;
  const version =
    typeof rawVersion === "string" && /^[0-9.]{1,32}$/.test(rawVersion) ? rawVersion : undefined;

  return name ? { name, ...(version ? { version } : {}) } : undefined;
}

function safeTag(event: ErrorEvent, key: string): unknown {
  return readProperty(event.tags, key);
}

function safeTypeErrorMessage(message: string): string | undefined {
  if (SAFE_TYPE_ERROR_MESSAGES.has(message)) return message;

  const propertyAccess = message.match(
    /^(Cannot (?:read|set) properties of (?:undefined|null)) \((reading|setting) '([^']+)'\)$/,
  );
  if (propertyAccess) {
    const [, prefix, operation, memberName] = propertyAccess;
    return memberName && SAFE_RUNTIME_MEMBER_NAMES.has(memberName)
      ? message
      : `${prefix} (${operation} a property)`;
  }

  if (/^.+ is not a function$/.test(message)) return "Value is not a function";
  if (/^.+ is not iterable$/.test(message)) return "Value is not iterable";

  return undefined;
}

/** 자유형 Error message는 버리고 알려진 JavaScript engine 진단만 제한적으로 보존한다. */
function safeRuntimeErrorMessage(exceptionType: string, value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 200 || /[\r\n]/.test(value))
    return undefined;

  if (exceptionType === "TypeError") return safeTypeErrorMessage(value);
  if (exceptionType === "RangeError" && SAFE_RANGE_ERROR_MESSAGES.has(value)) return value;
  if (exceptionType === "URIError" && value === "URI malformed") return value;
  if (exceptionType === "ReferenceError") {
    if (/^[A-Za-z_$][A-Za-z0-9_$]{0,63} is not defined$/.test(value))
      return "Identifier is not defined";
    if (/^Cannot access '[A-Za-z_$][A-Za-z0-9_$]{0,63}' before initialization$/.test(value))
      return "Cannot access identifier before initialization";
  }

  return undefined;
}

function safeExceptionMessage(
  errorType: ClientErrorType,
  exceptionType: string,
  value: unknown,
): string {
  if (errorType === "client-contract") return "Client response contract violation";
  if (errorType === "client-transport") return "Client transport error";

  return safeRuntimeErrorMessage(exceptionType, value) ?? "Unexpected client error";
}

export function toSafeSentryErrorContext(value: unknown): SentryErrorContext {
  const sourceValue = readProperty(value, "source");
  const digest = safeDigest(readProperty(value, "digest"));
  const source = isOneOf(sourceValue, SENTRY_ERROR_SOURCES) ? sourceValue : "sentry-auto-capture";

  return digest ? { source, digest } : { source };
}

export function describeClientError(error: unknown): ClientErrorType {
  const name = readProperty(error, "name");
  if (name === "ClientContractError") return "client-contract";
  if (name === "ClientTransportError") return "client-transport";
  return "runtime";
}

/** URL, DOM, console, network payload는 버리고 query/hash가 제거된 navigation만 남긴다. */
export function sanitizeClientBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (breadcrumb.category !== "navigation") return null;

  const from = stripUrlDetails(readProperty(breadcrumb.data, "from"));
  const to = stripUrlDetails(readProperty(breadcrumb.data, "to"));
  if (!from && !to) return null;

  return {
    category: "navigation",
    type: "navigation",
    level: "info",
    ...(typeof breadcrumb.timestamp === "number" ? { timestamp: breadcrumb.timestamp } : {}),
    data: {
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    },
  };
}

/** Browser SDK가 보강한 event도 전송 직전에 allowlist field만 남긴다. */
export function sanitizeClientSentryEvent(event: ErrorEvent): ErrorEvent {
  const sourceValue = safeTag(event, "source");
  const errorTypeValue = safeTag(event, "error.type");
  const digest = safeDigest(safeTag(event, "error.digest"));
  const source = isOneOf(sourceValue, SENTRY_ERROR_SOURCES) ? sourceValue : "sentry-auto-capture";
  const errorType = isOneOf(errorTypeValue, CLIENT_ERROR_TYPES) ? errorTypeValue : "runtime";
  const values = readProperty(readProperty(event, "exception"), "values");
  const lastException = Array.isArray(values) ? values[values.length - 1] : undefined;
  const rawExceptionType = readProperty(lastException, "type");
  const exceptionType = isOneOf(rawExceptionType, SAFE_EXCEPTION_TYPES)
    ? rawExceptionType
    : "Error";
  const exceptionValue = safeExceptionMessage(
    errorType,
    exceptionType,
    readProperty(lastException, "value"),
  );
  const stacktrace = safeStacktrace(event);
  const browser = safeContext(readProperty(event.contexts, "browser"), SAFE_BROWSER_NAMES);
  const os = safeContext(readProperty(event.contexts, "os"), SAFE_OS_NAMES);
  const breadcrumbs = Array.isArray(event.breadcrumbs)
    ? event.breadcrumbs.flatMap((breadcrumb) => {
        const safeBreadcrumb = sanitizeClientBreadcrumb(breadcrumb);
        return safeBreadcrumb ? [safeBreadcrumb] : [];
      })
    : [];

  return {
    type: undefined,
    ...(typeof event.event_id === "string" && /^[0-9a-f]{32}$/i.test(event.event_id)
      ? { event_id: event.event_id }
      : {}),
    ...(typeof event.timestamp === "number" ? { timestamp: event.timestamp } : {}),
    ...(isOneOf(event.level, SAFE_LEVELS) ? { level: event.level } : { level: "error" }),
    platform: "javascript",
    ...(isOneOf(event.environment, SAFE_ENVIRONMENTS) ? { environment: event.environment } : {}),
    ...toSafeSentryBuildMetadata(event),
    exception: {
      values: [
        {
          type: exceptionType,
          value: exceptionValue,
          ...(stacktrace ? { stacktrace } : {}),
        },
      ],
    },
    tags: {
      source,
      "error.type": errorType,
      ...(digest ? { "error.digest": digest } : {}),
    },
    ...(browser || os
      ? {
          contexts: {
            ...(browser ? { browser } : {}),
            ...(os ? { os } : {}),
          },
        }
      : {}),
    ...(breadcrumbs.length > 0 ? { breadcrumbs } : {}),
  };
}
