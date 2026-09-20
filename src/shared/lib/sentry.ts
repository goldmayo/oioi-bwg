import * as Sentry from "@sentry/nextjs";

import { getSentryRuntimeConfig } from "../config/sentry";

import {
  describeClientError,
  type SentryErrorContext,
  toSafeSentryErrorContext,
} from "./client-sentry-policy";

/**
 * 기존 호출부와 호환되는 최소 Sentry error reporter.
 * application logger나 범용 message/breadcrumb API로 사용하지 않는다.
 */
export const logger = {
  /**
   * 예외 상황을 캡처하여 Sentry로 전송하고, 에러 ID를 반환합니다.
   * @returns Sentry 이벤트 ID (사용자 문의 대응용)
   */
  error: (error: unknown, context: SentryErrorContext): string | null => {
    const safeContext = toSafeSentryErrorContext(context);
    const errorType = describeClientError(error);

    if (!getSentryRuntimeConfig().enabled) {
      console.error("[Sentry Dev Error]", {
        name: error instanceof Error ? error.name : "Error",
        source: safeContext.source,
        ...(safeContext.digest ? { digest: safeContext.digest } : {}),
        errorType,
      });
      return null;
    }

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
  },
};
