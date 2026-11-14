"use client";

import { type CSSProperties, lazy, type ReactNode, Suspense } from "react";
import { type Layout, verticalCompactor } from "react-grid-layout/core";
import { GripHorizontal } from "lucide-react";

import { useMediaQuery } from "@/shared/model/useMediaQuery";

import {
  dashboardGrid,
  type DashboardLayout,
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
  const compacted = verticalCompactor.compact(
    visible,
    dashboardGrid.cols,
  ) as DashboardLayout["desktop"];
  const visibleById = new Map(visible.map((item) => [item.i, item]));
  const items = desktop
    ? compacted.toSorted((a, b) => a.y - b.y || a.x - b.x)
    : layout.mobile.flatMap((id) => {
        const item = visibleById.get(id);
        return item ? [item] : [];
      });

  function renderWidget(id: WidgetId, draggable = false) {
    return (
      <div className="border-border bg-card flex h-full min-w-0 flex-col rounded-xl border">
        <header
          data-widget-grip={draggable ? "" : undefined}
          className={
            draggable
              ? "border-border flex shrink-0 cursor-grab items-center gap-2 border-b px-4 py-3 active:cursor-grabbing"
              : "flex shrink-0 items-center gap-2 px-4 py-3"
          }
        >
          {draggable && <GripHorizontal className="size-4 shrink-0" aria-hidden="true" />}
          <h2 id={"dashboard-widget-" + id} className="min-w-0 text-sm font-semibold break-keep">
            {widgetLabels[id]}
          </h2>
        </header>
        <div
          className={
            draggable
              ? "min-h-0 min-w-0 flex-1 overflow-auto px-4 pt-1 pb-4"
              : "min-w-0 px-4 pt-1 pb-4"
          }
          tabIndex={draggable ? 0 : undefined}
        >
          {widgets[id]}
        </div>
      </div>
    );
  }

  const staticGrid = (
    <div
      className="grid min-w-0 gap-(--widget-gap) lg:auto-rows-[minmax(var(--widget-row-height),auto)] lg:grid-cols-[repeat(var(--widget-columns),minmax(0,1fr))]"
      style={
        {
          "--widget-gap": dashboardGrid.margin[0] + "px",
          "--widget-row-height": dashboardGrid.rowHeight + "px",
          "--widget-columns": dashboardGrid.cols,
        } as CSSProperties
      }
    >
      {items.map(({ i, x, y, w, h }) => (
        <div
          key={i}
          data-widget={i}
          role="region"
          aria-labelledby={"dashboard-widget-" + i}
          className="min-w-0 lg:[grid-area:var(--widget-area)]"
          style={
            {
              "--widget-area": y + 1 + " / " + (x + 1) + " / span " + h + " / span " + w,
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
              {renderWidget(i, true)}
            </div>
          ))}
        </DashboardGridEditor>
      </Suspense>
    );
  }

  return staticGrid;
}
