import * as Sentry from "@sentry/nextjs";

/**
 * Next.js 표준 초기화 훅
 * 이 파일은 서버 기동 시 자동으로 실행됩니다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

/**
 * Next.js 15+ 서버 요청 에러 자동 캡처 (SDK 8.28.0+)
 * 프레임워크 레벨에서 발생하는 렌더링/데이터 페칭 에러를 포착합니다.
 */
export const onRequestError = Sentry.captureRequestError;

