import "server-only";

import { AppError } from "@oioi-bwg/server/errors/app-error";

import { getConsoleOrigin } from "@/shared/config/console-runtime";

/** Next Action의 Origin/Host 검사 및 Auth.js CSRF와 함께 사용하는 Console 경계. */
export function assertConsoleOrigin(headers: Headers) {
  if (headers.get("origin") !== getConsoleOrigin()) throw new AppError("FORBIDDEN");
}
