"use client";

import { createContext, useContext } from "react";
import type { ComponentProps, ComponentType, ContextType, CSSProperties, ReactNode } from "react";
import { createTableHookContexts, Subscribe } from "@tanstack/react-table";
import type { Column, ReactTable, RowData, TableFeatures } from "@tanstack/react-table";

export interface DataTableColumnMeta {
  label?: string;
  className?: string;
  filterVariant?: "text" | "select";
}

export type DataTableButtonProps = ComponentProps<"button">;
export interface DataTableComponents {
  Button?: ComponentType<DataTableButtonProps>;
}

const defaultComponents: DataTableComponents = {};
const componentsContext = createContext(defaultComponents);

function DefaultButton(props: DataTableButtonProps) {
  return <button {...props} />;
}

export function Button({
  type = "button",
  className = buttonClass,
  ...props
}: DataTableButtonProps) {
  const Component = useContext(componentsContext).Button ?? DefaultButton;
  return <Component type={type} className={className} {...props} />;
}

// React context는 소비처 generic을 보존하지 않는다. 내부 표시 경계만 넓게 읽고,
// 선택적인 API는 options.features 등록 여부를 확인한 뒤 사용한다.
type UiFeatures = TableFeatures & { columnMeta: DataTableColumnMeta };
const { tableContext, useTableContext } = createTableHookContexts<UiFeatures>();
export { useTableContext };

export function Root<TFeatures extends TableFeatures, TData extends RowData, TSelected>({
  table,
  components = defaultComponents,
  children,
}: {
  table: ReactTable<TFeatures, TData, TSelected>;
  components?: DataTableComponents;
  children: ReactNode;
}) {
  return (
    <tableContext.Provider value={table as unknown as ContextType<typeof tableContext>}>
      <componentsContext.Provider value={components}>{children}</componentsContext.Provider>
    </tableContext.Provider>
  );
}

export function Snapshot({ children }: { children: () => ReactNode }) {
  const table = useTableContext();
  // state가 같아도 새 data/columns/callback이 반영돼야 한다.
  return table.optionsStore ? (
    <Subscribe source={table.optionsStore}>
      {() => <Subscribe source={table.store}>{children}</Subscribe>}
    </Subscribe>
  ) : (
    <Subscribe source={table.store}>{children}</Subscribe>
  );
}

export function columnLabel(column: Column<UiFeatures, RowData>) {
  return (
    column.columnDef.meta?.label ??
    (typeof column.columnDef.header === "string" ? column.columnDef.header : column.id)
  );
}

export function columnStyle(column: Column<UiFeatures, RowData>): CSSProperties {
  const features = column.table.options.features;
  const pinned =
    features.columnPinningFeature && features.columnSizingFeature ? column.getIsPinned() : false;
  return {
    width: features.columnSizingFeature ? column.getSize() : undefined,
    position: pinned ? "sticky" : undefined,
    insetInlineStart: pinned === "start" ? column.getStart("start") : undefined,
    insetInlineEnd: pinned === "end" ? column.getAfter("end") : undefined,
    zIndex: pinned ? 1 : undefined,
    background: pinned ? "var(--background)" : undefined,
  };
}

export function setColumnWidth(column: Column<UiFeatures, RowData>, width: number) {
  if (!Number.isFinite(width)) return;
  column.table.setColumnSizing((previous) => ({
    ...previous,
    [column.id]: Math.max(
      column.columnDef.minSize ?? 20,
      Math.min(column.columnDef.maxSize ?? Number.MAX_SAFE_INTEGER, width),
    ),
  }));
}

export const buttonClass =
  "border-input hover:bg-accent focus-visible:ring-ring min-h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";
export const inputClass =
  "border-input bg-background focus-visible:ring-ring min-h-9 min-w-0 rounded-md border px-2 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50";
