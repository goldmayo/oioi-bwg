// Sentry는 개발 환경에서의 성능 간섭(Cloudflare Worker Crash)을 완전히 막기 위해 동적 로드만 사용합니다.

/**
 * Next.js 15/16 + Vinext 표준 초기화 훅
 * 이 파일은 서버 및 엣지 런타임 기동 시 자동으로 실행됩니다.
 * worker/index.ts를 직접 수정하지 않고도 Sentry를 초기화할 수 있는 가장 안전한 방법입니다.
 *
 * 주의: Cloudflare Workers 개발 환경(Vite Runner)에서 Sentry Tracing이 I/O 에러를 유발할 수 있으므로,
 * 개발 모드에서는 초기화를 건너뛰거나 설정을 최소화합니다.
 */
export async function register() {
  if (process.env.NODE_ENV === "development") {
    // 개발 모드에서는 에러 수집 및 트레이싱 비활성화 (Cloudflare I/O Span 에러 방지)
    // Sentry를 상단에서 import 하는 것만으로도 OpenTelemetry가 개입하므로 동적 로드합니다.
    return;
  }

  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Next.js 15+ 서버 요청 에러 자동 캡처 (SDK 8.28.0+)
 * 개발 모드에서는 Sentry 로드를 건너뛰어 성능 및 호환성을 유지합니다.
 */
export async function onRequestError(error: unknown, request: Request, context: unknown) {
  if (process.env.NODE_ENV === "development") return;
  const Sentry = await import("@sentry/nextjs");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Sentry.captureRequestError(error, request as any, context as any);
}
