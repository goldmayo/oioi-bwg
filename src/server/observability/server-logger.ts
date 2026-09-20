import "server-only";

import * as Sentry from "@sentry/nextjs";

import { getSentryRuntimeConfig } from "@/shared/config/sentry";

import {
  describeServerError,
  type SafeErrorDescriptor,
  type SafeRequestMetadata,
  type ServerErrorEvent,
  type ServerErrorSource,
  type ServerOperation,
  toSafeRequestMetadata,
  toSafeServerErrorEvent,
  toSafeServerErrorSource,
  toSafeServerOperation,
} from "./safe-server-event";

interface ReportServerErrorContext {
  event: ServerErrorEvent;
  source: ServerErrorSource;
  operation?: ServerOperation;
  error?: Partial<SafeErrorDescriptor>;
  request?: SafeRequestMetadata;
}

function isError(value: unknown): value is Error {
  try {
    return value instanceof Error;
  } catch {
    return false;
  }
}

/** 원본 오류를 직렬화하지 않고 운영에 필요한 안전한 분류만 기록한다. */
export function reportServerError(
  error: unknown,
  context: ReportServerErrorContext,
): string | null {
  const descriptor = describeServerError(error, context.error);
  const event = toSafeServerErrorEvent(context.event);
  const source = toSafeServerErrorSource(context.source);
  const operation = toSafeServerOperation(context.operation);
  const request = toSafeRequestMetadata(context.request);
  const tags = {
    event,
    source,
    ...(operation ? { operation } : {}),
    "error.type": descriptor.type,
    ...(descriptor.code ? { "error.code": descriptor.code } : {}),
    ...(request?.method ? { "request.method": request.method } : {}),
    ...(request?.routerKind ? { "next.router_kind": request.routerKind } : {}),
    ...(request?.routeType ? { "next.route_type": request.routeType } : {}),
  };

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "error",
      event,
      source,
      ...(operation ? { operation } : {}),
      error: descriptor,
      ...(request ? { request } : {}),
    }),
  );

  if (!getSentryRuntimeConfig().enabled) return null;

  // beforeSend가 전송 payload를 allowlist event로 다시 만든다. 원본 Error를 SDK에 전달해야
  // 발생 지점 stack frame이 유지되며 raw message/cause는 transport 전에 제거된다.
  const capturedError = isError(error) ? error : new Error("Unexpected server error");

  let eventId: string | null = null;
  Sentry.withScope((scope) => {
    scope.setTags(tags);
    eventId = Sentry.captureException(capturedError);
  });

  return eventId;
}
