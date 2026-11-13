"use client";

import { RotateCw } from "lucide-react";
import { Tabs } from "radix-ui";

import { Button } from "@/shared/ui/button";
import { Card, CardContent } from "@/shared/ui/card";
import { FilterSelect, ListFilterSheet } from "@/shared/ui/list-filter-sheet";

import {
  analyticsDateAgo,
  type AnalyticsMetric,
  analyticsMetrics,
  analyticsNumber,
} from "../_lib/analytics";
import { useDashboardAnalytics } from "../_model/use-dashboard-analytics";

import { AnalyticsPeriodFilter } from "./analytics-period-filter";
import { AnalyticsRankedReport } from "./analytics-ranked-report";
import { AnalyticsStatus } from "./analytics-status";
import { AnalyticsTrend } from "./analytics-trend";

export function DashboardAnalytics({ accountId }: { accountId: string }) {
  const state = useDashboardAnalytics(accountId);
  const [summary, trend, pages, traffic, devices, browsers] = state.reports;
  const busy = state.reports.some((query) => query.isFetching);
  const metricTitle = analyticsMetrics.find((item) => item.key === state.metric)!.title;
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
              id="analytics-traffic-filters"
              title="유입 경로 필터"
              activeCount={state.traffic === "channels" ? 0 : 1}
              values={{ traffic: state.traffic }}
              defaults={{ traffic: "channels" as const }}
              onApply={({ traffic }) => state.setTraffic(traffic)}
            >
              {({ register }) => (
                <FilterSelect label="유입 경로 구분" {...register("traffic")}>
                  <option value="channels">채널별</option>
                  <option value="sources">소스/매체별</option>
                </FilterSelect>
              )}
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
