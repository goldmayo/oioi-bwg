"use client";

import type { ComponentProps } from "react";
import type {
  DataTableButtonProps,
  DataTableColumnMeta,
  DataTableComponents,
} from "@oioi-bwg/ui/data-table";
import { DataTable } from "@oioi-bwg/ui/data-table";
import {
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createPaginatedRowModel,
  createSortedRowModel,
  createTableHook,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";
import { GripVertical } from "lucide-react";

import { cn } from "../lib/utils";

import { Button } from "./button";

/** Console의 목록은 같은 너비·셀 여백·줄바꿈 규칙을 사용한다. */
export function AppDataTable({ className, ...props }: ComponentProps<typeof DataTable.Table>) {
  return (
    <DataTable.Table
      fillWidth
      viewportClassName="max-h-[70dvh]"
      {...props}
      className={cn(
        "bg-card [&_th]:bg-card table-fixed [--data-table-row-height:3.5rem] [&_tbody_tr:not([data-table-padding])]:h-14 [&_td]:h-14 [&_td]:overflow-hidden [&_td]:px-3 [&_td]:py-0 [&_td]:whitespace-nowrap [&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:px-3",
        className,
      )}
    />
  );
}

function TableButton(props: DataTableButtonProps) {
  return <Button variant="ghost" {...props} />;
}

function ResizeHandleIcon() {
  return <GripVertical className="size-4" aria-hidden="true" />;
}

export const dataTableComponents = {
  Button: TableButton,
  ResizeHandleIcon,
} satisfies DataTableComponents;

// Console 목록의 선택이다. 공용 compound UI의 지원 기능을 제한하지 않는다.
const features = tableFeatures({
  rowSortingFeature,
  rowSelectionFeature,
  rowPaginationFeature,
  columnSizingFeature,
  columnResizingFeature,
  columnVisibilityFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export const { useAppTable, createAppColumnHelper } = createTableHook({
  features,
  defaultColumn: { sortFn: "text", sortDescFirst: false, minSize: 64, maxSize: 640 },
  columnResizeMode: "onChange",
});
