import "server-only";

import {
  getRequestAuthorization,
  type RequestAuthorization,
  type RequestContext,
} from "@/server/auth/request-context";

import { readRequestObservation } from "@/shared/lib/observability-correlation";

import { toErrorResponse } from "./api-response";
import { assertConsoleOrigin } from "./console-origin";

/** 알림 HTTP adapter의 인증·Origin·실패 응답 경계다. */
export async function notificationRoute(
  request: Request,
  route: string,
  action: (ctx: RequestContext) => Promise<Response>,
) {
  let authorization: RequestAuthorization | undefined;
  try {
    authorization = await getRequestAuthorization();
    if (request.method !== "GET") assertConsoleOrigin(request.headers);
    return await action(authorization.context);
  } catch (error) {
    return toErrorResponse(error, {
      route,
      ...readRequestObservation(request.headers, route),
      authorization,
    });
  }
}
