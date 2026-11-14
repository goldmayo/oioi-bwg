"use client";

import type { ReactNode } from "react";
import GridLayout, { type Layout, useContainerWidth } from "react-grid-layout";

import {
  dashboardGrid,
  type DashboardLayout,
  dashboardMaxWidgetRows,
  minimumWidgetSize,
  widgetHeight,
} from "../_model/dashboard-layout";

import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

const dragConfig = { handle: "[data-widget-grip]", bounded: true };

export function DashboardGridEditor({
  layout,
  onChange,
  children,
}: {
  layout: DashboardLayout["desktop"];
  onChange: (layout: Layout) => void;
  children: ReactNode;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  const grid = layout.map((item) => ({
    ...item,
    ...minimumWidgetSize(item.i),
    maxH: dashboardMaxWidgetRows,
  }));

  return (
    <div
      ref={containerRef}
      className="min-w-0"
      style={{ minHeight: widgetHeight(Math.max(...grid.map(({ y, h }) => y + h))) }}
    >
      {mounted && width > 0 && (
        <GridLayout
          width={width}
          layout={grid}
          gridConfig={dashboardGrid}
          dragConfig={dragConfig}
          onDragStop={onChange}
          onResizeStop={onChange}
          className="[&_.react-resizable-handle]:after:border-foreground/60"
        >
          {children}
        </GridLayout>
      )}
    </div>
  );
}
