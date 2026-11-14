"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { type AnalyticsRange, analyticsRangeSchema } from "@oioi-bwg/contracts/analytics";
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
  const [urlRange, setRange] = useQueryStates(urlState);
  const parsed = analyticsRangeSchema.safeParse(urlRange);
  const valid = parsed.success && urlRange.to <= analyticsDateAgo(1);
  const range = valid ? parsed.data : analyticsPreset(28);
  const form = useForm({
    values: range,
    resolver: zodResolver(analyticsRangeSchema),
    mode: "onChange",
  });
  const [from, to] = useWatch({ control: form.control, name: ["from", "to"] });
  const draft = { from, to };
  const [custom, setCustom] = useState(false);
  const [metric, setMetric] = useState<AnalyticsMetric>("users");
  const [traffic, setTraffic] = useState<"channels" | "sources">("channels");
  const reports = useQueries({
    queries: reportWidgets.map((id) => ({
      ...analyticsQuery(accountId, { ...range, report: id === "traffic" ? traffic : id }),
      enabled: !hidden.includes(id),
    })),
  });
  const visibleReports = reports.filter((_, index) => !hidden.includes(reportWidgets[index]));
  const preset = [7, 28, 90].find((days) => {
    const candidate = analyticsPreset(days);
    return candidate.from === range.from && candidate.to === range.to;
  });
  const draftValid =
    analyticsRangeSchema.safeParse(draft).success && draft.to <= analyticsDateAgo(1);

  return {
    range,
    draft,
    form,
    custom: custom || !preset,
    metric,
    setMetric,
    traffic,
    setTraffic,
    reports,
    visibleReports,
    draftValid,
    preset: custom ? "custom" : String(preset ?? "custom"),
    invalidUrl: Boolean(urlRange.from || urlRange.to) && !valid,
    selectPeriod(value: string) {
      setCustom(value === "custom");
      if (value === "custom") form.reset(range);
      else void setRange(analyticsPreset(Number(value)));
    },
    applyRange: (values: AnalyticsRange) => setRange(values),
    submitDesktopRange: form.handleSubmit((values) => {
      if (values.to <= analyticsDateAgo(1)) void setRange(values);
    }),
    refresh() {
      void Promise.allSettled(
        visibleReports.map((report) => report.refetch({ cancelRefetch: false })),
      );
    },
  };
}
