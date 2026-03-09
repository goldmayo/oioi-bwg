import * as Sentry from "@sentry/nextjs";

/**
 * 브라우저 환경 Sentry 초기화
 */
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN, // 공개 가능한 DSN

  // 성능 모니터링
  tracesSampleRate: 1.0,

  // 세션 리플레이 (사용자 에러 재현용)
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,

  // 디버깅 환경 설정
  debug: false,
});
