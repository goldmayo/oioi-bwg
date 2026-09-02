import { logger } from "@/shared/lib/sentry";

const capturedErrors = new WeakSet<object>();

/** 같은 Error 인스턴스가 Query cache와 Error Boundary에서 중복 보고되지 않게 한다. */
export function captureClientErrorOnce(error: unknown, context: Record<string, unknown>) {
  if (typeof error === "object" && error !== null) {
    if (capturedErrors.has(error)) return;
    capturedErrors.add(error);
  }

  logger.error(error, context);
}
