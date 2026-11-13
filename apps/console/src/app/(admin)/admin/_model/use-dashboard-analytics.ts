"use client";

import { useState } from "react";
import { type AnalyticsRange, analyticsRangeSchema } from "@oioi-bwg/contracts/analytics";
import { useQueries } from "@tanstack/react-query";
import { parseAsString, useQueryStates } from "nuqs";

import { analyticsQuery } from "@/entities/analytics-report";

import { analyticsDateAgo, type AnalyticsMetric, analyticsPreset } from "../_lib/analytics";

const urlState = {
  from: parseAsString.withDefault(""),
  to: parseAsString.withDefault(""),
};

export function useDashboardAnalytics(accountId: string) {
  const [urlRange, setRange] = useQueryStates(urlState);
  const parsed = analyticsRangeSchema.safeParse(urlRange);
  const valid = parsed.success && urlRange.to <= analyticsDateAgo(1);
  const range = valid ? parsed.data : analyticsPreset(28);
  const [metric, setMetric] = useState<AnalyticsMetric>("users");
  const [traffic, setTraffic] = useState<"channels" | "sources">("channels");
  const reports = useQueries({
    queries: (["summary", "trend", "pages", traffic, "devices", "browsers"] as const).map(
      (report) => analyticsQuery(accountId, { ...range, report }),
    ),
  });
  return {
    range,
    metric,
    setMetric,
    traffic,
    setTraffic,
    reports,
    invalidUrl: Boolean(urlRange.from || urlRange.to) && !valid,
    applyRange: (values: AnalyticsRange) => setRange(values),
    refresh() {
      void Promise.allSettled(reports.map((report) => report.refetch({ cancelRefetch: false })));
    },
  };
}
