import "server-only";

import * as Sentry from "@sentry/nextjs";

import { getSentryRuntimeConfig } from "@/shared/config/sentry";
import { toSafeRequestId } from "@/shared/lib/observability-correlation";
import { getSentryRouteMetadata } from "@/shared/lib/sentry-route-metadata";

import {
  describeServerError,
  describeServerFailure,
  type ServerErrorContext,
  toSafeRequestMetadata,
  toSafeServerErrorEvent,
  toSafeServerErrorSource,
  toSafeServerOperation,
} from "./safe-server-event";

function isError(value: unknown): value is Error {
  try {
    return value instanceof Error;
  } catch {
    return false;
  }
}

/** Unexpected server exception을 Sentry에 안전한 typed metadata와 함께 보고한다. */
export function captureServerException(error: unknown, context: ServerErrorContext): string | null {
  if (!getSentryRuntimeConfig().enabled) return null;

  const descriptor = describeServerError(error, context.error);
  const failure = describeServerFailure(descriptor, context);
  if (descriptor.type === "application" && failure.handling === "handled") return null;
  const event = toSafeServerErrorEvent(context.event);
  const source = toSafeServerErrorSource(context.source);
  const route = getSentryRouteMetadata(context.route);
  const operation = toSafeServerOperation(context.operation) ?? route?.operation;
  const request = toSafeRequestMetadata(context.request);
  const capturedError = isError(error) ? error : new Error("Unexpected server error");

  let eventId: string | null = null;
  Sentry.withScope((scope) => {
    scope.setTags({
      event,
      app: "console",
      runtime: "node",
      ...(route ? { "route.template": route.template } : {}),
      source,
      ...(operation ? { operation } : {}),
      "error.type": descriptor.type,
      "failure.kind": failure.kind,
      handling: failure.handling,
      outcome: failure.outcome,
      ...(descriptor.code ? { "error.code": descriptor.code } : {}),
      ...(request?.method ? { "request.method": request.method } : {}),
      ...(request?.routerKind ? { "next.router_kind": request.routerKind } : {}),
      ...(request?.routeType ? { "next.route_type": request.routeType } : {}),
    });
    const requestId = toSafeRequestId(context.requestId);
    if (requestId) scope.setContext("correlation", { request_id: requestId });
    eventId = Sentry.captureException(capturedError);
  });

  return eventId;
}
