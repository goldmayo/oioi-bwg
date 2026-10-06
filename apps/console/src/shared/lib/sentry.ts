import * as Sentry from "@sentry/nextjs";

import { getSentryRuntimeConfig } from "../config/sentry";

import {
  describeClientError,
  type SentryErrorContext,
  toSafeSentryErrorContext,
} from "./client-sentry-policy";

/** Client unexpected exception만 Sentry로 전송하는 error tracking 경계다. */
export function captureClientException(error: unknown, context: SentryErrorContext): string | null {
  const safeContext = toSafeSentryErrorContext(context);
  const errorType = describeClientError(error);

  if (!getSentryRuntimeConfig().enabled) return null;

  const errorObject = error instanceof Error ? error : new Error(String(error));
  let eventId: string | null = null;

  Sentry.withScope((scope) => {
    scope.setTags({
      source: safeContext.source,
      "error.type": errorType,
      ...(safeContext.digest ? { "error.digest": safeContext.digest } : {}),
    });
    eventId = Sentry.captureException(errorObject);
  });

  return eventId;
}
