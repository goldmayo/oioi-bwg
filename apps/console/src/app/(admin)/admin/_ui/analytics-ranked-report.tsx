"use client";

import type { ReactNode } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/ui/card";

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
        {report && report.rows.length > 0 && (
          <ol className="border-border border-t">
            {report.rows.map((row) => {
              const ratio = analyticsShare(row[metric], total);
              const label =
                report.report === "devices" ? (deviceLabels[row.label] ?? row.label) : row.label;
              return (
                <li key={row.label} className="space-y-2 pt-3">
                  <div className="flex items-center justify-between gap-4 text-sm">
                    <span className="min-w-0 break-words">{label}</span>
                    <span className="flex shrink-0 items-baseline gap-2 tabular-nums">
                      {share && (
                        <span className="text-muted-foreground text-xs">
                          {analyticsNumber.format(row[metric])}명
                        </span>
                      )}
                      <span className={share ? "text-base font-semibold" : ""}>
                        {share
                          ? ratio === null
                            ? "—"
                            : analyticsPercent.format(ratio)
                          : analyticsNumber.format(row[metric])}
                      </span>
                    </span>
                  </div>
                  {ratio !== null && (
                    <div
                      className={`bg-border w-full ${share ? "h-1 rounded-full" : "h-0.5"}`}
                      aria-hidden="true"
                    >
                      <div
                        className="bg-ring h-full rounded-[inherit]"
                        style={{ width: `${Math.min(ratio, 1) * 100}%` }}
                      />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
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
