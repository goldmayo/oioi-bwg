import "server-only";

import type { RequestObservation } from "@/shared/lib/observability-correlation";

import { logCredentialsRejection } from "./auth-rejection-logger";
import { reportServerError } from "./server-error-reporter";

function isCredentialsSignin(error: Error) {
  try {
    return Reflect.get(error, "type") === "CredentialsSignin";
  } catch {
    return false;
  }
}

/** Auth.js의 정상 credentials 거부와 조사해야 할 내부 실패를 분리한다. */
export function reportAuthError(error: Error, observation: RequestObservation = {}) {
  if (isCredentialsSignin(error)) {
    logCredentialsRejection(error, observation);
    return;
  }

  reportServerError(error, {
    event: "auth.failure",
    source: "auth-js",
    route: "/api/auth/[...nextauth]",
    ...observation,
    error: { type: "auth", code: "AUTH_FAILURE" },
  });
}
