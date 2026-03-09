import * as Sentry from "@sentry/nextjs";

/**
 * Next.js 15/16 + Vinext 표준 초기화 훅
 * 이 파일은 서버 및 엣지 런타임 기동 시 자동으로 실행됩니다.
 * worker/index.ts를 직접 수정하지 않고도 Sentry를 초기화할 수 있는 가장 안전한 방법입니다.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

/**
 * Next.js 15+ 서버 요청 에러 자동 캡처 (SDK 8.28.0+)
 * 프레임워크 레벨에서 발생하는 렌더링/데이터 페칭 에러를 포착합니다.
 */
export const onRequestError = Sentry.captureRequestError;
