"use client";

import type {
  DataTableButtonProps,
  DataTableColumnMeta,
  DataTableComponents,
} from "@oioi-bwg/ui/data-table";
import {
  createPaginatedRowModel,
  createSortedRowModel,
  createTableHook,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

import { Button } from "./button";

function TableButton(props: DataTableButtonProps) {
  return <Button variant="ghost" {...props} />;
}

export const dataTableComponents = { Button: TableButton } satisfies DataTableComponents;

// Console 목록의 선택이다. 공용 compound UI의 지원 기능을 제한하지 않는다.
const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
  columnMeta: metaHelper<DataTableColumnMeta>(),
});

export const { useAppTable, createAppColumnHelper } = createTableHook({
  features,
  defaultColumn: { sortFn: "text", sortDescFirst: false },
});
