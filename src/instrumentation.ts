import {
  toSafeMethod,
  toSafeRouterKind,
  toSafeRouteType,
} from "@/server/observability/safe-server-event";
import { reportServerError } from "@/server/observability/server-logger";

/**
 * Next.js instrumentation hook for the Node runtime.
 */
export async function register() {
  if (process.env.NODE_ENV === "development") {
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

/**
 * Next.js 서버 요청 에러 자동 캡처.
 */
function readContextValue(context: unknown, key: string): unknown {
  if (typeof context !== "object" || context === null) return undefined;

  try {
    return Reflect.get(context, key);
  } catch {
    return undefined;
  }
}

/** Next.js 서버 요청 오류에서 안전한 route 종류만 관측한다. */
export async function onRequestError(
  error: unknown,
  request: Readonly<{ method: string; [key: string]: unknown }>,
  context: unknown,
) {
  if (process.env.NODE_ENV === "development") return;

  reportServerError(error, {
    event: "next.request_error",
    source: "next-instrumentation",
    request: {
      method: toSafeMethod(request.method),
      routerKind: toSafeRouterKind(readContextValue(context, "routerKind")),
      routeType: toSafeRouteType(readContextValue(context, "routeType")),
    },
  });
}
