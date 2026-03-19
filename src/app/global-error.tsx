"use client";

import { useEffect } from "react";

/**
 * 전역 에러 핸들러 (App Router 전용)
 * 에러 발생 시에만 logger(Sentry)를 동적으로 로드하여 초기 번들 사이즈를 최적화합니다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 발생 시점에만 Sentry 로거를 불러와서 전송
    import("@/utils/sentry").then(({ logger }) => {
      logger.error(error, { digest: error.digest });
    });
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <div className="flex min-h-screen flex-col items-center justify-center bg-black p-4 text-center">
          <h2 className="text-muted-foreground mb-4 text-2xl font-bold">
            앗! 무언가 잘못되었습니다.
          </h2>
          <p className="text-muted-foreground mb-8">
            예기치 못한 오류가 발생했습니다. 서비스 이용에 불편을 드려 죄송합니다.
          </p>
          <button
            onClick={() => reset()}
            className="bg-qwer-w rounded-lg px-6 py-2 font-bold text-white transition-opacity hover:opacity-90"
          >
            다시 시도하기
          </button>
        </div>
      </body>
    </html>
  );
}
