"use client";

import { useEffect } from "react";

import { captureClientErrorOnce } from "@/shared/api/capture-client-error";
import { Button } from "@/shared/ui/button";

/** Admin route subtree의 초기 조회·렌더링 실패를 복구 가능한 화면으로 격리한다. */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    captureClientErrorOnce(error, { source: "admin-error-boundary", digest: error.digest });
  }, [error]);

  return (
    <section className="flex min-h-full flex-col items-center justify-center gap-4 p-6 text-center">
      <div>
        <h1 className="text-xl font-semibold">관리자 데이터를 불러오지 못했습니다.</h1>
        <p className="text-muted-foreground mt-2 text-sm">
          잠시 후 다시 시도해 주세요. 문제가 계속되면 운영 로그를 확인해 주세요.
        </p>
      </div>
      <Button type="button" onClick={reset}>
        다시 시도
      </Button>
    </section>
  );
}
