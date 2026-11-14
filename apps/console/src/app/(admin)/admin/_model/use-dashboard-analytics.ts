"use client";

import { useState } from "react";
import { analyticsRangeSchema } from "@oioi-bwg/contracts/analytics";
import { useQueries } from "@tanstack/react-query";
import { parseAsString, useQueryStates } from "nuqs";

import { analyticsQuery } from "@/entities/analytics-report";

import { analyticsDateAgo, type AnalyticsMetric, analyticsPreset } from "../_lib/analytics";

import type { WidgetId } from "./dashboard-layout";

const reportWidgets = ["summary", "trend", "pages", "traffic", "devices", "browsers"] as const;

const urlState = {
  from: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
};

export function useDashboardAnalytics(accountId: string, hidden: readonly WidgetId[]) {
  const [urlRange] = useQueryStates(urlState);
  const parsed = analyticsRangeSchema.safeParse(urlRange);
  const valid = parsed.success && urlRange.to <= analyticsDateAgo(1);
  const range = valid ? parsed.data : analyticsPreset(28);
  const [metric, setMetric] = useState<AnalyticsMetric>("users");
  const [traffic, setTraffic] = useState<"channels" | "sources">("sources");
  const reports = useQueries({
    queries: reportWidgets.map((id) => ({
      ...analyticsQuery(accountId, { ...range, report: id === "traffic" ? traffic : id }),
      enabled: !hidden.includes(id),
    })),
  });
  const visibleReports = reports.filter((_, index) => !hidden.includes(reportWidgets[index]));
  return { range, metric, setMetric, traffic, setTraffic, reports, visibleReports };
}
