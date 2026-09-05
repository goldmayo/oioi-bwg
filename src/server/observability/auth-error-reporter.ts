import "server-only";

import { reportServerError } from "./server-logger";

function isCredentialsSignin(error: Error) {
  try {
    return Reflect.get(error, "type") === "CredentialsSignin";
  } catch {
    return false;
  }
}

/** Auth.js의 정상 credentials 거부와 조사해야 할 내부 실패를 분리한다. */
export function reportAuthError(error: Error) {
  if (isCredentialsSignin(error)) return;

  reportServerError(error, {
    event: "auth.failure",
    source: "auth-js",
    error: { type: "auth", code: "AUTH_FAILURE" },
  });
}
