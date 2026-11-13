"use client";

import { useSyncExternalStore } from "react";
import { z } from "zod";

export const widgetLabels = {
  content: "콘텐츠 관리",
  jobs: "작업 알림",
  analytics: "공개 웹 이용 분석",
} as const;

const widgetId = z.enum(["content", "jobs", "analytics"]);
const gridItem = z.object({
  i: widgetId,
  x: z.number().int().min(0).max(5),
  y: z.number().int().min(0).max(24),
  w: z.number().int().min(2).max(6),
  h: z.number().int().min(2).max(8),
});
const settingsSchema = z.object({
  desktop: z
    .array(gridItem)
    .length(3)
    .refine(
      (items) =>
        new Set(items.map((item) => item.i)).size === 3 &&
        items.every((item) => item.x + item.w <= 6 && (item.i !== "analytics" || item.w >= 3)),
    ),
  mobile: z
    .array(widgetId)
    .length(3)
    .refine((items) => new Set(items).size === 3),
});

export type DashboardLayout = z.infer<typeof settingsSchema>;
export type WidgetId = z.infer<typeof widgetId>;
export const defaultDashboardLayout: DashboardLayout = {
  desktop: [
    { i: "content", x: 0, y: 0, w: 4, h: 4 },
    { i: "jobs", x: 4, y: 0, w: 2, h: 4 },
    { i: "analytics", x: 0, y: 4, w: 6, h: 4 },
  ],
  mobile: ["content", "jobs", "analytics"],
};

const changeEvent = "console:dashboard-layout";
const storageKey = (accountId: string) => "console:dashboard-layout:v1:" + accountId;
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
