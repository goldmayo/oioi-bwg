import "server-only";

import type { ServerErrorContext } from "./safe-server-event";
import { logServerError } from "./server-logger";
import { captureServerException } from "./server-sentry-reporter";

/** 운영 JSON log와 Sentry error tracking을 명시적으로 조합하는 상위 경계다. */
export function reportServerError(error: unknown, context: ServerErrorContext): string | null {
  logServerError(error, context);
  return captureServerException(error, context);
}
