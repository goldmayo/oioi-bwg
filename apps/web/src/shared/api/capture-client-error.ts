import {
  type SentryErrorContext,
  toSafeSentryErrorContext,
} from "@/shared/lib/client-sentry-policy";
import { captureClientException } from "@/shared/lib/sentry";

const capturedErrors = new WeakMap<object, Set<string>>();

/** 같은 오류의 동일 관측만 억제한다. Query 보고 뒤 최초 boundary mount는 별도로 남긴다. */
export function captureClientErrorOnce(error: unknown, context: SentryErrorContext) {
  const safeContext = toSafeSentryErrorContext(context);
  if (typeof error === "object" && error !== null) {
    const observations = capturedErrors.get(error) ?? new Set<string>();
    const observation = `${safeContext.source}:${safeContext.outcome}`;
    if (observations.has(observation)) return;
    observations.add(observation);
    capturedErrors.set(error, observations);
  }

  void captureClientException(error, safeContext);
}
