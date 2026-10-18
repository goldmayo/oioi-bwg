import "server-only";

import { AppError } from "@oioi-bwg/server/errors/app-error";

import { getConsoleOrigin } from "@/shared/config/console-runtime";

/** Next Action의 Origin/Host 검사 및 Auth.js CSRF와 함께 사용하는 Console 경계. */
export function assertConsoleHost(headers: Headers) {
  const origin = new URL(getConsoleOrigin());
  const required = origin.protocol === "https:";
  if (
    ((required || headers.has("host")) && headers.get("host") !== origin.host) ||
    ((required || headers.has("x-forwarded-host")) &&
      headers.get("x-forwarded-host") !== origin.host) ||
    ((required || headers.has("x-forwarded-proto")) &&
      headers.get("x-forwarded-proto") !== origin.protocol.slice(0, -1))
  )
    throw new AppError("FORBIDDEN");
}

export function assertConsoleOrigin(headers: Headers) {
  assertConsoleHost(headers);
  if (headers.get("origin") !== getConsoleOrigin()) throw new AppError("FORBIDDEN");
}
