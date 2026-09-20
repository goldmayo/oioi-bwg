import type { Breadcrumb, ErrorEvent } from "@sentry/nextjs";

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
    const functionName = safeStackText(readProperty(frame, "function"));
    const lineno = safeStackNumber(readProperty(frame, "lineno"));
    const colno = safeStackNumber(readProperty(frame, "colno"));

    if (!filename && !functionName && lineno === undefined && colno === undefined) return [];

    return [
      {
        ...(filename ? { filename } : {}),
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
    exception: {
      values: [
        {
          type: exceptionType,
          value: "Unexpected client error",
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
