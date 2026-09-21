import "server-only";

import {
  describeServerError,
  type ServerErrorContext,
  toSafeRequestMetadata,
  toSafeServerErrorEvent,
  toSafeServerErrorSource,
  toSafeServerOperation,
} from "./safe-server-event";

/** 원본 오류를 직렬화하지 않고 운영에 필요한 안전한 분류만 기록한다. */
export function logServerError(error: unknown, context: ServerErrorContext): void {
  const descriptor = describeServerError(error, context.error);
  const event = toSafeServerErrorEvent(context.event);
  const source = toSafeServerErrorSource(context.source);
  const operation = toSafeServerOperation(context.operation);
  const request = toSafeRequestMetadata(context.request);
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
}
