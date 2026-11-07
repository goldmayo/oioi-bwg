"use client";

import type { ReactNode } from "react";
import { Bar, BarChart, LabelList, XAxis, YAxis } from "recharts";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";
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

const deviceLabels: Record<string, string> = {
  mobile: "모바일",
  desktop: "데스크톱",
  tablet: "태블릿",
  "(not set)": "알 수 없음",
};

const chartConfig = { ratio: { color: "var(--ring)" } } satisfies ChartConfig;

function shortLabel(label: string) {
  return label.length > 10 ? `${label.slice(0, 9)}…` : label;
}

export function AnalyticsRankedReport({
  title,
  description,
  query,
  metric,
  share = false,
  action,
}: {
  title: string;
  description: string;
  query: AnalyticsResult;
  metric: AnalyticsMetric;
  share?: boolean;
  action?: ReactNode;
}) {
  const report = query.data;
  const total = report?.totals[metric] ?? 0;
  const rows = (report?.rows ?? []).map((row) => {
    const count = analyticsNumber.format(row[metric]);
    const ratio = analyticsShare(row[metric], total);
    const percent = ratio === null ? "—" : analyticsPercent.format(ratio);
    return {
      label: report?.report === "devices" ? (deviceLabels[row.label] ?? row.label) : row.label,
      ratio: Math.min(ratio ?? 0, 1),
      display: share ? `${percent} · ${count}명` : count,
    };
  });
  return (
    <Card
      role="region"
      aria-label={title}
      aria-busy={query.isFetching}
      className="min-w-0 gap-4 py-5 shadow-none"
    >
      <CardHeader className="px-4 sm:px-5">
        <CardTitle>
          <h3>{title}</h3>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
        {action && <CardAction>{action}</CardAction>}
      </CardHeader>
      <CardContent className="space-y-4 px-4 sm:px-5">
        {!share && report && (
          <p className="text-2xl font-semibold tabular-nums" aria-label="기간 전체 집계">
            {analyticsNumber.format(total)}
          </p>
        )}
        {report && report.rows.length === 0 && (
          <p className="text-muted-foreground text-sm">선택한 기간에 표시할 데이터가 없습니다.</p>
        )}
        {rows.length > 0 && (
          <div className="border-border space-y-2 border-t pt-2">
            {total > 0 && (
              <ChartContainer
                config={chartConfig}
                className="aspect-auto w-full"
                style={{ height: rows.length * 32 }}
              >
                <BarChart
                  accessibilityLayer
                  data={rows}
                  layout="vertical"
                  margin={{ top: 0, bottom: 0, left: 0, right: share ? 88 : 66 }}
                  barSize={7}
                >
                  <XAxis type="number" domain={[0, 1]} hide />
                  <YAxis
                    type="category"
                    dataKey="label"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: "var(--muted-foreground)" }}
                    tickMargin={8}
                    tickFormatter={shortLabel}
                    width={100}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        className="max-w-60 break-words"
                        formatter={(_, __, item) => item.payload.display}
                      />
                    }
                  />
                  <Bar
                    dataKey="ratio"
                    fill="var(--color-ratio)"
                    background={{ fill: "var(--muted)", radius: 3 }}
                    radius={3}
                    isAnimationActive={false}
                  >
                    <LabelList
                      dataKey="display"
                      position="right"
                      className="fill-foreground tabular-nums"
                      fontSize={12}
                      fontWeight={share ? 600 : 400}
                    />
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
            <details open={total === 0} className="text-muted-foreground text-xs">
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
            상위 {report.rows.length}개 항목을 표시합니다.
          </p>
        )}
        <AnalyticsStatus title={title} query={query} />
      </CardContent>
    </Card>
  );
}
