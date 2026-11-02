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

import { cn } from "../lib/utils";

import { Button } from "./button";

/** Console의 목록은 같은 너비·셀 여백·줄바꿈 규칙을 사용한다. */
export function AppDataTable({ className, ...props }: ComponentProps<typeof DataTable.Table>) {
  return (
    <DataTable.Table
      fillWidth
      {...props}
      className={cn(
        "bg-card table-fixed [&_td]:px-3 [&_td]:py-3 [&_td]:whitespace-normal [&_th]:px-3",
        className,
      )}
    />
  );
}

function TableButton(props: DataTableButtonProps) {
  return <Button variant="ghost" {...props} />;
}

export const dataTableComponents = { Button: TableButton } satisfies DataTableComponents;

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
