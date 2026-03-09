"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * 전역 에러 핸들러 (App Router 전용)
 * 루트 레이아웃 등 최상위에서 발생하는 에러를 포착하고 Sentry로 전송합니다.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // 에러 발생 시 즉시 Sentry에 보고
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="ko">
      <body>
        <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4 text-center">
          <h2 className="text-foreground mb-4 text-2xl font-bold">
            예기치 못한 오류가 발생했습니다. 서비스 이용에 불편을 드려 죄송합니다.
          </h2>
          <p className="text-muted-foreground mb-8"></p>
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
