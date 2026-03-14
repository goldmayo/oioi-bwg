import * as Sentry from "@sentry/nextjs";

/**
 * Node.js 서버 환경 전용 Sentry 초기화
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || "production",

  // 성능 트래킹 설정
  tracesSampleRate: 1.0,

  // 디버깅 모드
  debug: false,
});
