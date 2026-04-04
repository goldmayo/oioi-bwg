import * as Sentry from "@sentry/nextjs";

/**
 * Cloudflare Workers(Edge) 환경 전용 Sentry 초기화
 * instrumentation.ts를 통해 런타임 기동 시 자동 실행됩니다.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",

  // 성능 트래킹 설정: Cloudflare Workers에서는 SpanParent 전파가 I/O 컨텍스트를 침범하여 에러를 던지므로(Durable Object Limitation), Edge 환경에서는 트레이싱을 비활성화합니다.
  tracesSampleRate: 0.0,
  skipOpenTelemetrySetup: true,

  // 디버깅 모드 (운영 시 false 권장)
  debug: false,
});
