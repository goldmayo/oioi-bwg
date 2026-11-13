"use client";

import type { CSSProperties, ReactNode } from "react";

import { useMediaQuery } from "@/shared/model/useMediaQuery";

import { defaultDashboardLayout, useSavedDashboardLayout } from "../_model/dashboard-layout";

export function DashboardWidgets({
  accountId,
  content,
  jobs,
  analytics,
}: {
  accountId: string;
  content: ReactNode;
  jobs: ReactNode;
  analytics: ReactNode;
}) {
  const saved = useSavedDashboardLayout(accountId);
  const desktop = useMediaQuery("(min-width: 1024px)");
  const layout = saved ?? defaultDashboardLayout;
  const widgets = { content, jobs, analytics };
  const items = desktop
    ? layout.desktop.toSorted((a, b) => a.y - b.y || a.x - b.x)
    : layout.mobile.map((id) => layout.desktop.find((item) => item.i === id)!);

  return (
    <div className="mt-10 grid items-start gap-x-6 gap-y-6 lg:grid-cols-6">
      {items.map(({ i, x, y, w, h }) => (
        <div
          key={i}
          className="min-w-0 lg:min-h-(--widget-height) lg:[grid-area:var(--widget-area)]"
          style={
            {
              "--widget-area": saved
                ? `${y + 1} / ${x + 1} / span ${h} / span ${w}`
                : `${i === "analytics" ? 2 : 1} / ${x + 1} / auto / span ${w}`,
              "--widget-height": saved ? `${h * 36}px` : undefined,
            } as CSSProperties
          }
        >
          {widgets[i]}
        </div>
      ))}
    </div>
  );
}
