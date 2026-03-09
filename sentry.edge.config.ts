import * as Sentry from "@sentry/nextjs";

/**
 * Cloudflare Workers(Edge) 환경 전용 Sentry 초기화
 * instrumentation.ts를 통해 런타임 기동 시 자동 실행됩니다.
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // 성능 트래킹 설정
  tracesSampleRate: 0.1,

  // 디버깅 모드 (운영 시 false 권장)
  debug: false,
});
