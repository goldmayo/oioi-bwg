"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, Pie, PieChart, XAxis, YAxis } from "recharts";

import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/shared/ui/chart";

import {
  type AnalyticsMetric,
  analyticsNumber,
  analyticsPercent,
  analyticsShare,
} from "../_lib/analytics";

import { type AnalyticsResult, AnalyticsStatus } from "./analytics-status";
import { DashboardSkeleton } from "./dashboard-skeleton";

const deviceLabels: Record<string, string> = {
  mobile: "모바일",
  desktop: "데스크톱",
  tablet: "태블릿",
  "(not set)": "알 수 없음",
};

const chartConfig = { count: { color: "var(--chart-1)" } } satisfies ChartConfig;
const maxBarRows = 8;
const pieColors = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5"];

type RankedRow = { label: string; count: number; display: string };

function AnalyticsBars({ rows }: { rows: RankedRow[] }) {
  return (
    <ChartContainer
      config={chartConfig}
      className="aspect-auto w-full"
      style={{ height: Math.max(rows.length * 24, 96) }}
    >
      <BarChart accessibilityLayer data={rows} layout="vertical" margin={{ right: 8 }}>
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="label"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          tickFormatter={shortLabel}
          width={92}
        />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              className="max-w-60 break-words"
              labelFormatter={(_, items) => items[0]?.payload.label}
              nameKey="count"
              formatter={(_, __, item) => item.payload.display}
            />
          }
        />
        <Bar dataKey="count" fill="var(--color-count)" radius={5} isAnimationActive={false} />
      </BarChart>
    </ChartContainer>
  );
}

function AnalyticsDonut({ rows }: { rows: RankedRow[] }) {
  const positiveRows = rows
    .filter(({ count }) => count > 0)
    .map(({ label, count }) => ({ label, count }));
  const categories = positiveRows.slice(0, pieColors.length);
  if (positiveRows.length > pieColors.length) {
    const remaining = positiveRows.slice(pieColors.length - 1);
    categories[pieColors.length - 1] = {
      label: `그 외 ${remaining.length}개 항목`,
      count: remaining.reduce((sum, row) => sum + row.count, 0),
    };
  }
  const slices = categories.map(({ label, count }, index) => ({
    label,
    count,
    fill: `var(${pieColors[index]})`,
  }));
  if (slices.length === 0) return null;

  return (
    <figure aria-label="표시된 항목의 활성 사용자 집계 구성" className="space-y-2">
      <ChartContainer config={chartConfig} className="mx-auto aspect-square h-44 w-full max-w-52">
        <PieChart accessibilityLayer>
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                hideLabel
                formatter={(_, __, { payload }) => (
                  <span className="flex w-full justify-between gap-3">
                    {payload.label}
                    <span className="font-medium tabular-nums">
                      {analyticsNumber.format(payload.count)}명
                    </span>
                  </span>
                )}
              />
            }
          />
          <Pie
            data={slices}
            dataKey="count"
            nameKey="label"
            innerRadius="58%"
            outerRadius="96%"
            stroke="var(--card)"
            strokeWidth={2}
            isAnimationActive={false}
          />
        </PieChart>
      </ChartContainer>
      <figcaption>
        <ul className="text-muted-foreground flex flex-wrap justify-center gap-x-3 gap-y-1 text-xs">
          {slices.map(({ label, fill }) => (
            <li key={label} className="flex min-w-0 items-center gap-1.5 break-all">
              <span
                aria-hidden="true"
                className="size-2 shrink-0 rounded-xs"
                style={{ background: fill }}
              />
              {label}
            </li>
          ))}
        </ul>
      </figcaption>
    </figure>
  );
}

function shortLabel(label: string) {
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
}

export function AnalyticsRankedReport({
  title,
  description,
  query,
  metric,
  summaryTotal,
  share = false,
  action,
}: {
  title: string;
  description: string;
  query: AnalyticsResult;
  metric: AnalyticsMetric;
  summaryTotal?: number;
  share?: boolean;
  action?: ReactNode;
}) {
  const report = query.data;
  const total = report?.totals[metric] ?? 0;
  const rows = (report?.rows ?? []).map((row) => {
    const count = row[metric];
    const formattedCount = analyticsNumber.format(count);
    const ratio = analyticsShare(count, total);
    const percent = ratio === null ? "—" : analyticsPercent.format(ratio);
    return {
      label: report?.report === "devices" ? (deviceLabels[row.label] ?? row.label) : row.label,
      count,
      display: share ? `${percent} · ${formattedCount}명` : formattedCount,
    };
  });
  const barRows = rows.slice(0, maxBarRows);
  return (
    <div aria-busy={query.isFetching} className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs">{description}</p>
        {action}
      </div>
      {!report && query.isPending && <DashboardSkeleton variant={share ? "donut" : "rows"} />}
      {!share && report && total !== summaryTotal && (
        <p className="text-2xl font-semibold tabular-nums" aria-label="기간 전체 집계">
          {analyticsNumber.format(total)}
        </p>
      )}
      {report && report.rows.length === 0 && (
        <p className="text-muted-foreground text-sm">선택한 기간에 표시할 데이터가 없습니다.</p>
      )}
      {rows.length > 0 && (
        <div className="space-y-2">
          {total > 0 && (share ? <AnalyticsDonut rows={rows} /> : <AnalyticsBars rows={barRows} />)}
          {!share && total > 0 && rows.length > barRows.length && (
            <p className="text-muted-foreground text-xs">
              차트는 상위 {barRows.length}개 항목을 표시합니다.
            </p>
          )}
          <details className="text-muted-foreground text-xs">
            <summary className="focus-visible:outline-ring cursor-pointer py-2 outline-offset-2 focus-visible:outline-2">
              항목별 수치 보기
            </summary>
            <ol className="space-y-2">
              {rows.map(({ label, display }) => (
                <li key={label} className="flex justify-between gap-3">
                  <span className="min-w-0 break-words">{label}</span>
                  <span className="text-foreground shrink-0 tabular-nums">{display}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}
      {report?.truncated && (
        <p className="text-muted-foreground text-xs">
          항목별 수치는 GA4 상위 {report.rows.length}개까지 제공됩니다.
        </p>
      )}
      <AnalyticsStatus title={title} query={query} />
    </div>
  );
}
