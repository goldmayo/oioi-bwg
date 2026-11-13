"use client";

import { RotateCw } from "lucide-react";
import { Tabs } from "radix-ui";

import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { Input } from "@/shared/ui/input";
import { ListFilterSheet } from "@/shared/ui/list-filter-sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import {
  analyticsDateAgo,
  type AnalyticsMetric,
  analyticsMetrics,
  analyticsNumber,
  analyticsPreset,
} from "../_lib/analytics";
import { useDashboardAnalytics } from "../_model/use-dashboard-analytics";

import { AnalyticsRankedReport } from "./analytics-ranked-report";
import { AnalyticsStatus } from "./analytics-status";
import { AnalyticsTrend } from "./analytics-trend";

export function DashboardAnalytics({ accountId }: { accountId: string }) {
  const state = useDashboardAnalytics(accountId);
  const [summary, trend, pages, traffic, devices, browsers] = state.reports;
  const busy = state.reports.some((query) => query.isFetching);
  const metricTitle = analyticsMetrics.find((item) => item.key === state.metric)!.title;
  const defaultRange = analyticsPreset(28);
  const hasPeriodFilter =
    state.range.from !== defaultRange.from || state.range.to !== defaultRange.to;
  return (
    <section aria-labelledby="analytics-heading" className="border-border space-y-4 border-t pt-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="analytics-heading" className="text-xl font-semibold tracking-tight">
            공개 웹 이용 분석
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">방문 추세와 유입 경로를 확인합니다.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ListFilterSheet
            title="이용 분석 필터"
            description="공개 웹 이용 분석의 집계 기간을 선택합니다."
            activeCount={hasPeriodFilter ? 1 : 0}
          >
            <div className="grid gap-1.5">
              <span className="text-muted-foreground text-xs">조회 기간</span>
              <Select value={state.preset} onValueChange={state.selectPeriod}>
                <SelectTrigger aria-label="조회 기간" className="w-full data-[size=default]:h-11">
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
            </div>
            {state.custom && (
              <form className="grid grid-cols-2 items-end gap-2" onSubmit={state.applyRange}>
                <label className="min-w-0 space-y-1 text-sm">
                  <span>시작일</span>
                  <Input
                    type="date"
                    className="min-h-11"
                    required
                    {...state.form.register("from")}
                    max={state.draft.to || analyticsDateAgo(1)}
                  />
                </label>
                <label className="min-w-0 space-y-1 text-sm">
                  <span>종료일</span>
                  <Input
                    type="date"
                    className="min-h-11"
                    required
                    {...state.form.register("to")}
                    min={state.draft.from}
                    max={analyticsDateAgo(1)}
                  />
                </label>
                <Button type="submit" className="col-span-2 min-h-11" disabled={!state.draftValid}>
                  기간 적용
                </Button>
                <p className="text-muted-foreground col-span-2 text-xs">
                  최대 366일, 종료일은 어제까지 선택할 수 있습니다.
                </p>
              </form>
            )}
          </ListFilterSheet>
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
      <p className="text-muted-foreground text-xs tabular-nums" aria-live="polite">
        집계 기간 {state.range.from} ~ {state.range.to} · 서울 시간
      </p>
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
      <Card className="gap-0 overflow-hidden py-0 shadow-none">
        <Tabs.Root
          value={state.metric}
          onValueChange={(value) => state.setMetric(value as AnalyticsMetric)}
        >
          <Tabs.List aria-label="추세 지표" className="border-border grid grid-cols-3 border-b">
            {analyticsMetrics.map(({ key, title }) => (
              <Tabs.Trigger
                key={key}
                value={key}
                className="text-muted-foreground data-[state=active]:border-ring data-[state=active]:text-foreground hover:bg-accent/30 focus-visible:outline-ring flex min-w-0 flex-col gap-2 border-b-2 border-transparent px-3 py-3 text-left outline-offset-[-3px] focus-visible:outline-2 sm:px-5 sm:py-4"
              >
                <span className="text-xs break-keep sm:text-sm">{title}</span>
                <span className="text-foreground text-xl font-semibold tabular-nums sm:text-2xl">
                  {summary.data ? analyticsNumber.format(summary.data.totals[key]) : "—"}
                </span>
              </Tabs.Trigger>
            ))}
          </Tabs.List>
          <CardContent className="space-y-3 px-4 py-4 sm:px-5 sm:py-5">
            <AnalyticsStatus title="방문 요약" query={summary} hideTimestamp={!summary.isError} />
            <Tabs.Content value={state.metric} className="space-y-3" aria-busy={trend.isFetching}>
              <h3 className="text-sm font-medium">{metricTitle} 추세</h3>
              {trend.data && <AnalyticsTrend report={trend.data} metric={state.metric} />}
              <AnalyticsStatus title="일별 추세" query={trend} />
            </Tabs.Content>
          </CardContent>
        </Tabs.Root>
      </Card>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <AnalyticsRankedReport
          title="페이지별 조회수"
          description="조회수 상위 페이지"
          query={pages}
          metric="views"
        />
        <AnalyticsRankedReport
          title="유입 경로"
          description={state.traffic === "channels" ? "채널별 세션 수" : "소스/매체별 세션 수"}
          query={traffic}
          metric="sessions"
          action={
            <ListFilterSheet
              title="유입 경로 필터"
              description="유입 경로를 채널 또는 소스와 매체로 나눠 봅니다."
              activeCount={state.traffic === "channels" ? 0 : 1}
            >
              <div className="grid gap-1.5">
                <span className="text-muted-foreground text-xs">유입 경로 구분</span>
                <Select
                  value={state.traffic}
                  onValueChange={(value) => state.setTraffic(value as "channels" | "sources")}
                >
                  <SelectTrigger
                    aria-label="유입 경로 구분"
                    className="w-full data-[size=default]:h-11"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" align="end">
                    <SelectItem value="channels">채널별</SelectItem>
                    <SelectItem value="sources">소스/매체별</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </ListFilterSheet>
          }
        />
      </div>
      <section aria-labelledby="environment-heading" className="space-y-3">
        <div>
          <h3 id="environment-heading" className="font-semibold">
            접속 환경
          </h3>
          <p className="text-muted-foreground mt-1 text-sm break-keep">
            전체 활성 사용자 대비 비율입니다. 여러 기기·브라우저를 사용하면 비율 합계가 100%를 넘을
            수 있습니다.
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          <AnalyticsRankedReport
            title="기기별 활성 사용자"
            description="모바일 · 데스크톱 · 태블릿"
            query={devices}
            metric="users"
            share
          />
          <AnalyticsRankedReport
            title="브라우저별 활성 사용자"
            description="브라우저별 사용자 비율"
            query={browsers}
            metric="users"
            share
          />
        </div>
      </section>
    </section>
  );
}
