"use client";

import { type ReactNode, useCallback, useRef, useState } from "react";
import type { Layout } from "react-grid-layout";
import Link from "next/link";

import { adminPaths } from "@/shared/config/admin-routes";
import { Button } from "@/shared/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";

import { type AnalyticsMetric, analyticsMetrics, analyticsNumber } from "../_lib/analytics";
import {
  type DashboardLayout,
  defaultDashboardLayout,
  saveDashboardLayout,
  useSavedDashboardLayout,
  type WidgetId,
} from "../_model/dashboard-layout";
import { useDashboardAnalytics } from "../_model/use-dashboard-analytics";

import { AnalyticsRankedReport } from "./analytics-ranked-report";
import { AnalyticsStatus } from "./analytics-status";
import { AnalyticsTrend } from "./analytics-trend";
import { DashboardLayoutControls } from "./dashboard-layout-controls";
import { DashboardPeriod } from "./dashboard-period";
import { DashboardSkeleton } from "./dashboard-skeleton";
import { DashboardWidgets } from "./dashboard-widgets";

export function DashboardAnalytics({
  accountId,
  content,
  jobs,
  editing,
}: {
  accountId: string;
  content: ReactNode;
  jobs: ReactNode;
  editing: boolean;
}) {
  const saved = useSavedDashboardLayout(accountId);
  const [draft, setDraft] = useState<DashboardLayout>();
  const [notice, setNotice] = useState<"saved" | "error">();
  const layout = draft ?? saved ?? defaultDashboardLayout;
  const state = useDashboardAnalytics(
    accountId,
    saved === undefined ? defaultDashboardLayout.mobile : layout.hidden,
  );
  const [summary, trend, pages, traffic, devices, browsers] = state.reports;
  const hasShownTrend = useRef(false);
  const revealTrend = useCallback((path: SVGPathElement | null) => {
    if (!path?.getAttribute("d") || hasShownTrend.current) return;
    const chart = path.closest("[data-chart]");
    if (!chart) return;

    hasShownTrend.current = true;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    if (!("registerProperty" in CSS)) return;

    // Recharts can replace the path while it measures the axes. Animate its stable container.
    chart.animate([{ "--analytics-trend-reveal": "100%" }, { "--analytics-trend-reveal": "0%" }], {
      duration: 320,
    });
  }, []);
  const showsAnalytics = layout.mobile.some(
    (id) => id !== "content" && id !== "jobs" && !layout.hidden.includes(id),
  );

  function update(next: DashboardLayout) {
    setDraft(next);
    setNotice(undefined);
  }

  function updateDesktop(items: Layout) {
    const changes = new Map(items.map(({ i, x, y, w, h }) => [i, { x, y, w, h }]));
    update({
      ...layout,
      desktop: layout.desktop.map((item) => ({ ...item, ...changes.get(item.i) })),
    });
  }

  function toggle(id: WidgetId) {
    const hidden = layout.hidden.includes(id)
      ? layout.hidden.filter((item) => item !== id)
      : [...layout.hidden, id];
    update({ ...layout, hidden });
  }

  function moveMobile(from: number, to: number) {
    const mobile = [...layout.mobile];
    const visible = mobile.filter((id) => !layout.hidden.includes(id));
    const source = mobile.indexOf(visible[from]);
    const target = mobile.indexOf(visible[to]);
    [mobile[source], mobile[target]] = [mobile[target], mobile[source]];
    update({ ...layout, mobile });
  }

  function save() {
    try {
      saveDashboardLayout(accountId, layout);
      setDraft(undefined);
      setNotice("saved");
    } catch {
      setNotice("error");
    }
  }

  const widgets = {
    content,
    jobs,
    summary: (
      <>
        {!summary.data && summary.isPending ? (
          <DashboardSkeleton variant="summary" />
        ) : (
          <dl className="grid grid-cols-3 gap-3">
            {analyticsMetrics.map(({ key, title }) => (
              <div key={key} className="min-w-0">
                <dt className="text-muted-foreground text-xs break-keep">{title}</dt>
                <dd className="mt-1 text-xl font-semibold tabular-nums">
                  {summary.data ? analyticsNumber.format(summary.data.totals[key]) : "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}
        <AnalyticsStatus title="방문 요약" query={summary} hideTimestamp={!summary.isError} />
      </>
    ),
    trend: (
      <div className="space-y-3">
        <Select
          value={state.metric}
          onValueChange={(value) => state.setMetric(value as AnalyticsMetric)}
        >
          <SelectTrigger aria-label="추세 지표" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {analyticsMetrics.map(({ key, title }) => (
              <SelectItem key={key} value={key}>
                {title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {!trend.data && trend.isPending && <DashboardSkeleton variant="chart" />}
        {trend.data && <AnalyticsTrend report={trend.data} metric={state.metric} onCurveReady={revealTrend} />}
        <AnalyticsStatus title="일별 추세" query={trend} />
      </div>
    ),
    pages: (
      <AnalyticsRankedReport
        title="페이지별 조회수"
        description="조회수 상위 페이지"
        query={pages}
        metric="views"
      />
    ),
    traffic: (
      <AnalyticsRankedReport
        title="유입 경로"
        description={state.traffic === "channels" ? "채널별 세션 수" : "소스/매체별 세션 수"}
        query={traffic}
        metric="sessions"
        action={
          <Select
            value={state.traffic}
            onValueChange={(value) => state.setTraffic(value as "channels" | "sources")}
          >
            <SelectTrigger aria-label="유입 경로 구분" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="channels">채널별</SelectItem>
              <SelectItem value="sources">소스/매체별</SelectItem>
            </SelectContent>
          </Select>
        }
      />
    ),
    devices: (
      <AnalyticsRankedReport
        title="기기별 활성 사용자"
        description="전체 활성 사용자 대비 비율"
        query={devices}
        metric="users"
        share
      />
    ),
    browsers: (
      <AnalyticsRankedReport
        title="브라우저별 활성 사용자"
        description="전체 활성 사용자 대비 비율"
        query={browsers}
        metric="users"
        share
      />
    ),
  };

  return (
    <section className="mx-auto w-full max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {editing ? "대시보드 관리" : "대시보드"}
          </h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {editing
              ? "위젯 배치는 이 브라우저에 계정별로 저장됩니다."
              : "콘텐츠를 관리하고 작업 결과를 확인합니다."}
          </p>
        </div>
        {!editing && (
          <Button variant="outline" className="h-11 md:h-9" asChild>
            <Link href={adminPaths.dashboardSettings}>대시보드 관리</Link>
          </Button>
        )}
      </header>
      {editing && (
        <DashboardLayoutControls
          layout={layout}
          dirty={!!draft}
          notice={notice}
          onToggle={toggle}
          onMove={moveMobile}
          onReset={() => update(defaultDashboardLayout)}
          onSave={save}
        />
      )}
      {showsAnalytics && <DashboardPeriod state={state} />}
      <DashboardWidgets
        layout={layout}
        widgets={widgets}
        editing={editing}
        onDesktopChange={updateDesktop}
      />
    </section>
  );
}
