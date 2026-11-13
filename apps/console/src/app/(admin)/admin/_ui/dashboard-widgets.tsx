"use client";

import { type CSSProperties, lazy, type ReactNode, Suspense } from "react";
import { type Layout, verticalCompactor } from "react-grid-layout/core";
import { GripHorizontal } from "lucide-react";

import { useMediaQuery } from "@/shared/model/useMediaQuery";

import {
  type DashboardLayout,
  defaultDashboardLayout,
  widgetHeight,
  type WidgetId,
  widgetLabels,
} from "../_model/dashboard-layout";

const DashboardGridEditor = lazy(() =>
  import("./dashboard-grid-editor").then((module) => ({ default: module.DashboardGridEditor })),
);

export function DashboardWidgets({
  layout,
  widgets,
  editing,
  onDesktopChange,
}: {
  layout: DashboardLayout;
  widgets: Record<WidgetId, ReactNode>;
  editing: boolean;
  onDesktopChange: (items: Layout) => void;
}) {
  const desktop = useMediaQuery("(min-width: 1024px)");
  const visible = layout.desktop.filter(({ i }) => !layout.hidden.includes(i));
  const compacted = verticalCompactor.compact(visible, 6) as DashboardLayout["desktop"];
  const visibleById = new Map(visible.map((item) => [item.i, item]));
  const items = desktop
    ? compacted.toSorted((a, b) => a.y - b.y || a.x - b.x)
    : layout.mobile.flatMap((id) => {
        const item = visibleById.get(id);
        return item ? [item] : [];
      });

  function renderWidget(id: WidgetId) {
    return (
      <div className="border-border bg-card flex h-full min-w-0 flex-col rounded-xl border">
        <header
          data-widget-grip={editing && desktop ? "" : undefined}
          className={
            editing && desktop
              ? "border-border flex shrink-0 cursor-grab items-center gap-2 border-b px-4 py-3 active:cursor-grabbing"
              : "flex shrink-0 items-center gap-2 px-4 py-3"
          }
        >
          {editing && desktop && <GripHorizontal className="size-4 shrink-0" aria-hidden="true" />}
          <h2 id={"dashboard-widget-" + id} className="min-w-0 text-sm font-semibold break-keep">
            {widgetLabels[id]}
          </h2>
        </header>
        <div className="min-h-0 flex-1 overflow-auto px-4 pt-1 pb-4" tabIndex={0}>
          {widgets[id]}
        </div>
      </div>
    );
  }

  const staticGrid = (
    <div className="grid min-w-0 gap-3 lg:auto-rows-[32px] lg:grid-cols-6">
      {items.map(({ i, x, y, w, h }) => (
        <div
          key={i}
          data-widget={i}
          role="region"
          aria-labelledby={"dashboard-widget-" + i}
          className="h-(--widget-mobile-height) min-h-0 min-w-0 lg:h-auto lg:[grid-area:var(--widget-area)]"
          style={
            {
              "--widget-area": y + 1 + " / " + (x + 1) + " / span " + h + " / span " + w,
              "--widget-mobile-height":
                widgetHeight(defaultDashboardLayout.desktop.find((item) => item.i === i)!.h) + "px",
            } as CSSProperties
          }
        >
          {renderWidget(i)}
        </div>
      ))}
    </div>
  );

  if (editing && desktop) {
    return (
      <Suspense fallback={staticGrid}>
        <DashboardGridEditor layout={items} onChange={onDesktopChange}>
          {items.map(({ i }) => (
            <div key={i} data-widget={i} role="region" aria-labelledby={"dashboard-widget-" + i}>
              {renderWidget(i)}
            </div>
          ))}
        </DashboardGridEditor>
      </Suspense>
    );
  }

  return staticGrid;
}
