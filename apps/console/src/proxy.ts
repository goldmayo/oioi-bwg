import { randomUUID } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import {
  INTERNAL_REQUEST_ID,
  INTERNAL_ROUTE_TEMPLATE,
} from "@/shared/lib/observability-correlation";
import { getSentryRouteMetadata } from "@/shared/lib/sentry-route-metadata";

/** 외부 값을 재사용하지 않고 관리 네트워크 요청마다 새 관측 ID를 발급한다. */
export function proxy(request: NextRequest) {
  const requestId = randomUUID();
  const headers = new Headers(request.headers);
  headers.delete("x-request-id");
  headers.set(INTERNAL_REQUEST_ID, requestId);
  const route = getSentryRouteMetadata(request.nextUrl.pathname);
  if (route) headers.set(INTERNAL_ROUTE_TEMPLATE, route.template);
  else headers.delete(INTERNAL_ROUTE_TEMPLATE);
  const response = NextResponse.next({ request: { headers } });
  response.headers.set("X-Request-ID", requestId);
  return response;
}
export const config = {
  matcher: [
    "/admin/:path*",
    "/admin-login",
    "/api/admin/:path*",
    "/api/auth/:path*",
    "/api/operator/:path*",
  ],
};
