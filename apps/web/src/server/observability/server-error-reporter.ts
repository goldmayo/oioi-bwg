import "server-only";

import { getSentryRuntimeConfig } from "@/shared/config/sentry";
import { toSafeEventId, toSafeRequestId } from "@/shared/lib/sentry/correlation";

import type { ServerErrorContext } from "./safe-server-event";
import { logServerError } from "./server-logger";
import { captureServerException } from "./server-sentry-reporter";

const reported = new WeakMap<object, Map<string, string | null>>();

/** 독립 sink를 조합한다. SDK 반환은 수신 확인이 아니며 한쪽 실패가 원래 처리를 막지 않는다. */
export function reportServerError(error: unknown, context: ServerErrorContext): string | null {
  const requestId = toSafeRequestId(context.requestId);
  const observations =
    typeof error === "object" && error !== null
      ? (reported.get(error) ?? new Map<string, string | null>())
      : undefined;
  if (requestId && observations?.has(requestId)) return observations.get(requestId) ?? null;
  if (requestId && observations && typeof error === "object" && error !== null) {
    observations.set(requestId, null);
    reported.set(error, observations);
  }
  let status: "requested" | "disabled" | "capture_failed" = "disabled";
  let eventId: string | undefined;
  try {
    const enabled = getSentryRuntimeConfig().enabled;
    const result = captureServerException(error, context);
    status = enabled ? "requested" : "disabled";
    if (enabled) eventId = toSafeEventId(result);
  } catch {
    status = "capture_failed";
  }
  try {
    logServerError(error, context, { status, ...(eventId ? { eventId } : {}) });
  } catch {
    /* 관측 sink 실패를 application 예외로 바꾸지 않는다. */
  }
  if (requestId) observations?.set(requestId, eventId ?? null);
  return eventId ?? null;
}
