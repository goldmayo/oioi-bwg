"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

export const widgetLabels = {
  content: "콘텐츠 공개 현황",
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
export const dashboardGrid = {
  cols: 12,
  rowHeight: 20,
  margin: [12, 12],
  containerPadding: [0, 0],
} as const;
export const widgetHeight = (rows: number) =>
  rows * (dashboardGrid.rowHeight + dashboardGrid.margin[1]) - dashboardGrid.margin[1];

const widgetMinimum = {
  summary: { minW: 6, minH: 4 },
  content: { minW: 3, minH: 5 },
  jobs: { minW: 2, minH: 4 },
  trend: { minW: 6, minH: 13 },
  traffic: { minW: 5, minH: 13 },
  pages: { minW: 5, minH: 13 },
  devices: { minW: 5, minH: 12 },
  browsers: { minW: 5, minH: 12 },
} satisfies Record<WidgetId, { minW: number; minH: number }>;

export const dashboardMaxWidgetRows = 22;

export function minimumWidgetSize(id: WidgetId) {
  return widgetMinimum[id];
}

const position = z.number().int().nonnegative();
const gridItem = z.object({
  i: widgetId,
  x: position,
  y: position,
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});
const unique = (ids: WidgetId[]) => new Set(ids).size === ids.length;
const layoutSchema = z.object({
  desktop: z
    .array(gridItem)
    .length(widgetId.options.length)
    .refine((items) => unique(items.map(({ i }) => i))),
  mobile: z.array(widgetId).length(widgetId.options.length).refine(unique),
  hidden: z
    .array(widgetId)
    .max(widgetId.options.length - 1)
    .refine(unique),
});
const settingsSchema = layoutSchema.refine(({ desktop }) =>
  desktop.every(({ i, x, y, w, h }) => {
    const { minW, minH } = minimumWidgetSize(i);
    return (
      x + w <= dashboardGrid.cols &&
      y <= 240 &&
      w >= minW &&
      h >= minH &&
      h <= dashboardMaxWidgetRows
    );
  }),
);

export type DashboardLayout = z.infer<typeof settingsSchema>;

export const defaultDashboardLayout: DashboardLayout = {
  desktop: [
    { i: "summary", x: 0, y: 0, w: 6, h: 5 },
    { i: "content", x: 6, y: 0, w: 4, h: 5 },
    { i: "jobs", x: 10, y: 0, w: 2, h: 5 },
    { i: "trend", x: 0, y: 5, w: 12, h: 13 },
    { i: "traffic", x: 0, y: 18, w: 6, h: 13 },
    { i: "pages", x: 6, y: 18, w: 6, h: 13 },
    { i: "devices", x: 0, y: 31, w: 6, h: 12 },
    { i: "browsers", x: 6, y: 31, w: 6, h: 12 },
  ],
  mobile: ["summary", "trend", "traffic", "pages", "content", "jobs", "devices", "browsers"],
  hidden: [],
};

function migrateLegacyLayout(value: unknown) {
  const legacy = layoutSchema.safeParse(value);
  if (!legacy.success) return null;
  const { desktop, mobile, hidden } = legacy.data;
  if (
    desktop.some(
      ({ i, x, y, w, h }) =>
        x + w > 6 || y > 150 || w < (i === "content" || i === "jobs" ? 2 : 3) || h < 3 || h > 16,
    )
  )
    return null;

  // 가로 칸은 2배로 늘고, 세로 한 칸과 간격은 44px에서 32px로 바뀐다.
  const toRows = (rows: number) => Math.round((rows * 44) / 32);
  return {
    desktop: desktop.map(({ i, x, y, w, h }) => ({
      i,
      x: x * 2,
      y: toRows(y),
      w: w * 2,
      h: Math.max(minimumWidgetSize(i).minH, toRows(y + h) - toRows(y)),
    })),
    mobile,
    hidden,
  };
}

const changeEvent = "console:dashboard-layout";
const storageKey = (accountId: string, version = 3) =>
  `console:dashboard-layout:v${version}:${accountId}`;
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
        const saved = localStorage.getItem(storageKey(accountId));
        if (saved !== null) return "3:" + saved;
        const legacy = localStorage.getItem(storageKey(accountId, 2));
        return legacy === null ? null : "2:" + legacy;
      } catch {
        return null;
      }
    },
    serverSnapshot,
  );
  if (snapshot == null) return snapshot;
  try {
    const value: unknown = JSON.parse(snapshot.slice(2));
    if (snapshot.startsWith("2:")) return migrateLegacyLayout(value);
    const parsed = settingsSchema.safeParse(value);
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
