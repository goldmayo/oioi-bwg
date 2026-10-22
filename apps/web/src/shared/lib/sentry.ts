import * as Sentry from "@sentry/nextjs";

import { getSentryRuntimeConfig } from "../config/sentry";

import {
  describeClientError,
  type SentryErrorContext,
  toSafeSentryErrorContext,
} from "./client-sentry-policy";
import { getSentryRouteMetadata } from "./sentry-route-metadata";

/** Client unexpected exception만 Sentry로 전송하는 error tracking 경계다. */
export async function captureClientException(
  error: unknown,
  context: SentryErrorContext,
): Promise<string | null> {
  const safeContext = toSafeSentryErrorContext(context);
  const route = getSentryRouteMetadata(
    safeContext.route ?? (typeof window === "undefined" ? undefined : window.location.pathname),
  );
  const errorType = describeClientError(error);

  if (!getSentryRuntimeConfig().enabled) return null;

  const client = Sentry.getClient();
  if (!client) return null;

  try {
    const scope = Sentry.getCurrentScope().clone();
    scope.setTags({
      app: "web",
      runtime: "browser",
      ...(route ? { "route.template": route.template, operation: route.operation } : {}),
      source: safeContext.source,
      outcome: safeContext.outcome,
      "error.type": errorType,
      ...(safeContext.digest ? { "error.digest": safeContext.digest } : {}),
    });
    const errorObject = error instanceof Error ? error : new Error("Unexpected client error");
    // 원본 frame은 SDK가 만든다. originalException hint를 다시 붙이면 SDK의 객체 중복 제거가
    // Query 보고 이후의 별도 boundary 관측까지 버리므로, 관측별 중복은 호출 경계가 소유한다.
    const event = await client.eventFromException(errorObject);
    return scope.captureEvent(event);
  } catch {
    // 관측 실패가 새 unhandled rejection을 만들거나 오류 화면의 복구를 막지 않게 한다.
    return null;
  }
}
