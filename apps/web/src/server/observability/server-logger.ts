import "server-only";

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

/** 원본 오류를 직렬화하지 않고 운영에 필요한 안전한 분류만 기록한다. */
export function logServerError(error: unknown, context: ServerErrorContext): void {
  const descriptor = describeServerError(error, context.error);
  const failure = describeServerFailure(descriptor, context);
  if (descriptor.type === "application" && failure.handling === "handled") return;
  const event = toSafeServerErrorEvent(context.event);
  const source = toSafeServerErrorSource(context.source);
  const route = getSentryRouteMetadata(context.route);
  const operation = toSafeServerOperation(context.operation) ?? route?.operation;
  const request = toSafeRequestMetadata(context.request);
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event,
      app: "web",
      runtime: "node",
      ...(route ? { route: { template: route.template } } : {}),
      source,
      ...(operation ? { operation } : {}),
      error: descriptor,
      failure: { kind: failure.kind },
      handling: failure.handling,
      outcome: failure.outcome,
      ...(request ? { request } : {}),
    }),
  );
}
