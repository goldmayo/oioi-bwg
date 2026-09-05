import "server-only";

import * as Sentry from "@sentry/nextjs";

import {
  describeServerError,
  type SafeErrorDescriptor,
  type SafeRequestMetadata,
  type ServerErrorEvent,
  type ServerErrorSource,
  toSafeRequestMetadata,
  toSafeServerErrorEvent,
  toSafeServerErrorSource,
} from "./safe-server-event";

interface ReportServerErrorContext {
  event: ServerErrorEvent;
  source: ServerErrorSource;
  error?: Partial<SafeErrorDescriptor>;
  request?: SafeRequestMetadata;
}

function shouldCaptureSentry() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "staging"
  );
}

/** 원본 오류를 직렬화하지 않고 운영에 필요한 안전한 분류만 기록한다. */
export function reportServerError(
  error: unknown,
  context: ReportServerErrorContext,
): string | null {
  const descriptor = describeServerError(error, context.error);
  const event = toSafeServerErrorEvent(context.event);
  const source = toSafeServerErrorSource(context.source);
  const request = toSafeRequestMetadata(context.request);
  const tags = {
    event,
    source,
    "error.type": descriptor.type,
    ...(descriptor.code ? { "error.code": descriptor.code } : {}),
    ...(request?.method ? { "request.method": request.method } : {}),
    ...(request?.routerKind ? { "next.router_kind": request.routerKind } : {}),
    ...(request?.routeType ? { "next.route_type": request.routeType } : {}),
  };

  console.error({
    timestamp: new Date().toISOString(),
    level: "error",
    event,
    source,
    error: descriptor,
    ...(request ? { request } : {}),
  });

  if (!shouldCaptureSentry()) return null;

  const safeError = new Error("Unexpected server error");
  safeError.name =
    descriptor.type === "auth"
      ? "AuthError"
      : descriptor.type === "database"
        ? "DatabaseError"
        : descriptor.type === "output-contract"
          ? "OutputContractError"
          : "UnknownError";

  let eventId: string | null = null;
  Sentry.withScope((scope) => {
    scope.setTags(tags);
    eventId = Sentry.captureException(safeError);
  });

  return eventId;
}
