"use client";

import type { AnalyticsReport } from "@oioi-bwg/contracts/analytics";
import type { UseQueryResult } from "@tanstack/react-query";
import { CircleAlert } from "lucide-react";
import Link from "next/link";

import { ApiError } from "@/shared/api/http-errors";
import { Button } from "@/shared/ui/button";

import { analyticsTime } from "../_lib/analytics";

export type AnalyticsResult = UseQueryResult<AnalyticsReport>;

export function AnalyticsStatus({ title, query }: { title: string; query: AnalyticsResult }) {
  const loginRequired = query.error instanceof ApiError && query.error.status === 401;
  return (
    <div className="space-y-2 text-sm" aria-live="polite">
      {query.isFetching && (
        <p className="text-muted-foreground" role="status">
          {query.data ? "갱신 중입니다." : "조회 중입니다."}
        </p>
      )}
      {query.isError && (
        <div className="flex flex-wrap items-center justify-between gap-2" role="alert">
          <p className="flex items-center gap-2 break-keep">
            <CircleAlert className="text-destructive size-4 shrink-0" aria-hidden="true" />
            {query.error instanceof ApiError ? query.error.message : "통계를 불러오지 못했습니다."}
          </p>
          {loginRequired ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin-login">관리자 로그인</Link>
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-8"
              aria-label={`${title} 다시 시도`}
              disabled={query.isFetching}
              onClick={() => {
                void query.refetch({ cancelRefetch: false });
              }}
            >
              다시 시도
            </Button>
          )}
        </div>
      )}
      {query.data && query.isError && (
        <p className="text-muted-foreground text-xs">
          마지막 성공 결과 {analyticsTime.format(new Date(query.data.fetchedAt))}
        </p>
      )}
      {query.data && (query.data.thresholded || query.data.sampled) && (
        <p className="text-muted-foreground text-xs">
          GA4 데이터 기준 또는 표본 추출이 적용된 집계입니다.
        </p>
      )}
    </div>
  );
}
