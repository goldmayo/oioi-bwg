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
export async function onRequestError(error: unknown, request: Request, context: unknown) {
  if (process.env.NODE_ENV === "development") return;
  const Sentry = await import("@sentry/nextjs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Sentry.captureRequestError(error, request as any, context as any);
}
