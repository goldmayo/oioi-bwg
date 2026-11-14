"use client";

import { CalendarDays, RotateCw } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import { analyticsDateAgo, analyticsTime } from "../_lib/analytics";
import type { useDashboardAnalytics } from "../_model/use-dashboard-analytics";

import { AnalyticsPeriodFilter } from "./analytics-period-filter";

export function DashboardPeriod({
  state,
  showsShareReport,
}: {
  state: ReturnType<typeof useDashboardAnalytics>;
  showsShareReport: boolean;
}) {
  const busy = state.visibleReports.some((query) => query.isFetching);
  const latestRefresh = state.visibleReports
    .flatMap((query) => (query.isSuccess ? [query.data.fetchedAt] : []))
    .sort()
    .at(-1);
  return (
    <section aria-label="GA4 조회 기간" className="space-y-3">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">GA4 조회 기간</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            표시 중인 모든 GA4 위젯에 같은 기간을 적용합니다.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={state.preset} onValueChange={state.selectPeriod}>
            <SelectTrigger aria-label="조회 기간" className="hidden min-h-9 md:flex">
              <CalendarDays aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" align="start">
              {[7, 28, 90].map((days) => (
                <SelectItem key={days} value={String(days)}>
                  최근 {days}일
                </SelectItem>
              ))}
              <SelectItem value="custom">직접 선택</SelectItem>
            </SelectContent>
          </Select>
          <AnalyticsPeriodFilter range={state.range} onApply={state.applyRange} />
          <Button
            variant="outline"
            className="min-h-11 sm:min-h-9"
            disabled={busy}
            onClick={state.refresh}
          >
            <RotateCw aria-hidden="true" />
            전체 새로고침
          </Button>
        </div>
      </header>
      {state.custom && (
        <form
          className="hidden flex-wrap items-end gap-2 md:flex"
          onSubmit={state.submitDesktopRange}
        >
          <label className="w-36 max-w-full space-y-1 text-sm">
            <span>시작일</span>
            <Input
              type="date"
              className="min-h-11 sm:min-h-9"
              required
              {...state.form.register("from")}
              max={state.draft.to || analyticsDateAgo(1)}
            />
          </label>
          <label className="w-36 max-w-full space-y-1 text-sm">
            <span>종료일</span>
            <Input
              type="date"
              className="min-h-11 sm:min-h-9"
              required
              {...state.form.register("to")}
              min={state.draft.from}
              max={analyticsDateAgo(1)}
            />
          </label>
          <Button type="submit" className="min-h-11 sm:min-h-9" disabled={!state.draftValid}>
            기간 적용
          </Button>
          <p className="text-muted-foreground w-full text-xs">
            최대 366일, 종료일은 어제까지 선택할 수 있습니다.
          </p>
        </form>
      )}
      <div
        className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs tabular-nums"
        aria-live="polite"
      >
        <p>
          집계 기간 {state.range.from} ~ {state.range.to} · 서울 시간
        </p>
        {latestRefresh && <p>최근 갱신 {analyticsTime.format(new Date(latestRefresh))}</p>}
      </div>
      {showsShareReport && (
        <p className="text-muted-foreground text-xs">
          항목별 수치의 비율은 전체 활성 사용자 기준입니다. 여러 기기나 브라우저를 쓰면 비율 합계가
          100%를 넘을 수 있습니다.
        </p>
      )}
      {state.invalidUrl && (
        <p role="status" className="text-muted-foreground text-sm">
          주소의 조회 기간을 확인할 수 없어 최근 28일을 표시합니다.
        </p>
      )}
      {state.range.to === analyticsDateAgo(1) && (
        <p className="text-muted-foreground text-xs">
          전날 집계는 GA4 처리에 따라 달라질 수 있습니다.
        </p>
      )}
    </section>
  );
}
