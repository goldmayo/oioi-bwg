"use client";

import type { AnalyticsReport } from "@oioi-bwg/contracts/analytics";
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";

import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/shared/ui/chart";

import {
  type AnalyticsMetric,
  analyticsMetrics,
  analyticsNumber,
  analyticsSeries,
} from "../_lib/analytics";

export function AnalyticsTrend({
  report,
  metric,
}: {
  report: AnalyticsReport;
  metric: AnalyticsMetric;
}) {
  if (report.rows.length === 0)
    return (
      <p className="text-muted-foreground py-8 text-sm">선택한 기간에 표시할 데이터가 없습니다.</p>
    );
  const series = analyticsSeries(report, metric);
  const title = analyticsMetrics.find(({ key }) => key === metric)?.title;
  return (
    <figure aria-label="날짜별 이용 추세" className="space-y-3">
      <ChartContainer
        config={{ value: { label: title, color: "var(--ring)" } }}
        className="aspect-auto h-48 w-full sm:h-60"
      >
        <LineChart accessibilityLayer data={series} margin={{ top: 8, left: 14, right: 6 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.65} />
          <XAxis
            dataKey="date"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)" }}
            tickMargin={8}
            minTickGap={28}
            interval="preserveStartEnd"
            tickFormatter={(date: string) => date.slice(5).replace("-", ".")}
          />
          <YAxis
            orientation="right"
            width="auto"
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "var(--muted-foreground)" }}
            tickCount={4}
            tickFormatter={(value: number) => analyticsNumber.format(value)}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Line
            dataKey="value"
            type="linear"
            stroke="var(--color-value)"
            strokeWidth={2}
            dot={
              report.rows.length <= 14
                ? { r: 2, strokeWidth: 0, fill: "var(--color-value)" }
                : false
            }
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ChartContainer>
      <details className="text-muted-foreground text-xs">
        <summary className="focus-visible:outline-ring cursor-pointer py-2 outline-offset-2 focus-visible:outline-2">
          일별 수치 보기
        </summary>
        <div className="max-h-48 overflow-y-auto">
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr>
                <th scope="col">날짜</th>
                <th scope="col" className="text-right">
                  집계
                </th>
              </tr>
            </thead>
            <tbody>
              {series.map(({ date, value }) => (
                <tr key={date}>
                  <td className="py-1">{date}</td>
                  <td className="text-right">
                    {value === null ? "—" : analyticsNumber.format(value)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
