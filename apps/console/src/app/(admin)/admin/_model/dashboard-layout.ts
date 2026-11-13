"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

export const widgetLabels = {
  content: "콘텐츠 관리",
  jobs: "작업 알림",
  summary: "방문 요약",
  trend: "일별 이용 추세",
  pages: "페이지별 조회수",
  traffic: "유입 경로",
  devices: "기기별 활성 사용자",
  browsers: "브라우저별 활성 사용자",
} as const;

const widgetId = z.enum([
  "content",
  "jobs",
  "summary",
  "trend",
  "pages",
  "traffic",
  "devices",
  "browsers",
]);
export type WidgetId = z.infer<typeof widgetId>;
const gridItem = z.object({
  i: widgetId,
  x: z.number().int().min(0).max(5),
  y: z.number().int().min(0).max(150),
  w: z.number().int().min(2).max(6),
  h: z.number().int().min(3).max(16),
});
const unique = (ids: WidgetId[]) => new Set(ids).size === ids.length;
const settingsSchema = z.object({
  desktop: z
    .array(gridItem)
    .length(widgetId.options.length)
    .refine(
      (items) =>
        unique(items.map((item) => item.i)) &&
        items.every((item) => item.x + item.w <= 6 && item.w >= minimumWidgetWidth(item.i)),
    ),
  mobile: z.array(widgetId).length(widgetId.options.length).refine(unique),
  hidden: z
    .array(widgetId)
    .max(widgetId.options.length - 1)
    .refine(unique),
});

export type DashboardLayout = z.infer<typeof settingsSchema>;
export const dashboardGrid = {
  cols: 6,
  rowHeight: 32,
  margin: [12, 12],
  containerPadding: [0, 0],
} as const;
export const widgetHeight = (rows: number) =>
  rows * (dashboardGrid.rowHeight + dashboardGrid.margin[1]) - dashboardGrid.margin[1];

export function minimumWidgetWidth(id: WidgetId) {
  return id === "content" || id === "jobs" ? 2 : 3;
}

export const defaultDashboardLayout: DashboardLayout = {
  desktop: [
    { i: "content", x: 0, y: 0, w: 4, h: 7 },
    { i: "jobs", x: 4, y: 0, w: 2, h: 7 },
    { i: "summary", x: 0, y: 7, w: 6, h: 3 },
    { i: "trend", x: 0, y: 10, w: 6, h: 10 },
    { i: "pages", x: 0, y: 20, w: 3, h: 11 },
    { i: "traffic", x: 3, y: 20, w: 3, h: 11 },
    { i: "devices", x: 0, y: 31, w: 3, h: 11 },
    { i: "browsers", x: 3, y: 31, w: 3, h: 11 },
  ],
  mobile: [...widgetId.options],
  hidden: [],
};

const changeEvent = "console:dashboard-layout";
const storageKey = (accountId: string) => "console:dashboard-layout:v2:" + accountId;
const serverSnapshot = () => undefined;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(changeEvent, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(changeEvent, onChange);
  };
}

export function useSavedDashboardLayout(accountId: string) {
  const snapshot = useSyncExternalStore(
    subscribe,
    () => {
      try {
        return localStorage.getItem(storageKey(accountId));
      } catch {
        return null;
      }
    },
    serverSnapshot,
  );
  if (snapshot == null) return snapshot;
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(snapshot));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function saveDashboardLayout(accountId: string, layout: DashboardLayout) {
  const parsed = settingsSchema.parse(layout);
  localStorage.setItem(storageKey(accountId), JSON.stringify(parsed));
  window.dispatchEvent(new Event(changeEvent));
}
