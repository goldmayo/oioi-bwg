"use client";

import { useState } from "react";
import {
  aggregationFn_sum,
  columnFacetingFeature,
  columnFilteringFeature,
  columnGroupingFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnResizingFeature,
  columnSizingFeature,
  columnVisibilityFeature,
  createColumnHelper,
  createExpandedRowModel,
  createFacetedMinMaxValues,
  createFacetedRowModel,
  createFacetedUniqueValues,
  createFilteredRowModel,
  createGroupedRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  filterFn_equalsString,
  filterFn_includesString,
  globalFilteringFeature,
  metaHelper,
  rowAggregationFeature,
  rowExpandingFeature,
  rowPaginationFeature,
  rowPinningFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import type { ColumnVisibilityState, PaginationState } from "@tanstack/react-table";

import { DataTable, type DataTableColumnMeta } from "./data-table";

// README와 테스트가 함께 사용하는 메모리 예제. 제품 runtime의 기본 profile이 아니다.
const features = tableFeatures({
  rowSortingFeature,
  columnFilteringFeature,
  globalFilteringFeature,
  columnFacetingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowExpandingFeature,
  columnGroupingFeature,
  rowAggregationFeature,
  columnOrderingFeature,
  columnPinningFeature,
  columnVisibilityFeature,
  columnSizingFeature,
  columnResizingFeature,
  rowPinningFeature,
  columnMeta: metaHelper<DataTableColumnMeta>(),
  filterFns: { includesString: filterFn_includesString, equalsString: filterFn_equalsString },
  sortFns: { text: sortFn_text, basic: sortFn_basic },
  aggregationFns: { sum: aggregationFn_sum },
});

const browserFeatures = tableFeatures({
  ...features,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  groupedRowModel: createGroupedRowModel(),
  expandedRowModel: createExpandedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  facetedRowModel: createFacetedRowModel(),
  facetedUniqueValues: createFacetedUniqueValues(),
  facetedMinMaxValues: createFacetedMinMaxValues(),
});

export type ExampleOrder = {
  id: string;
  name: string;
  department: string;
  status: string;
  amount: number;
};
export const exampleOrders: ExampleOrder[] = Array.from({ length: 24 }, (_, index) => ({
  id: `order-${index + 1}`,
  name: `주문 ${String(index + 1).padStart(2, "0")}`,
  department: ["개발", "운영", "영업"][index % 3],
  status: ["대기", "진행", "완료", "완료"][index % 4],
  amount: (index + 1) * 10000,
}));
const column = createColumnHelper<typeof browserFeatures, ExampleOrder>();
const columns = column.columns([
  column.display({
    id: "selection",
    header: "선택",
    size: 72,
    enableHiding: false,
    enableResizing: false,
    cell: ({ row }) =>
      row.getIsGrouped() ? null : (
        <DataTable.RowSelect rowId={row.id} label={`${row.original.name} 선택`} />
      ),
  }),
  column.accessor("name", {
    header: "이름",
    enableGlobalFilter: true,
    enableHiding: false,
    size: 180,
    meta: { filterVariant: "text" },
    footer: "검색 결과 합계",
  }),
  column.accessor("department", {
    header: "부서",
    enableGlobalFilter: true,
    enableGrouping: true,
    filterFn: "equalsString",
    meta: { filterVariant: "select" },
  }),
  column.accessor("status", {
    header: "상태",
    enableGlobalFilter: true,
    enableGrouping: true,
    filterFn: "equalsString",
    meta: { filterVariant: "select" },
  }),
  column.accessor("amount", {
    header: "금액",
    sortFn: "basic",
    aggregationFn: "sum",
    aggregatedCell: ({ getValue }) => Number(getValue() ?? 0).toLocaleString("ko-KR"),
    cell: ({ getValue }) => getValue().toLocaleString("ko-KR"),
    footer: ({ column }) =>
      Number(column.getAggregationValue<number>() ?? 0).toLocaleString("ko-KR"),
  }),
  column.display({
    id: "pin",
    header: "행 고정",
    size: 150,
    enableResizing: false,
    cell: ({ row }) =>
      row.getIsGrouped() ? null : (
        <DataTable.RowPin rowId={row.id} label={`${row.original.name} 행 고정`} />
      ),
  }),
]);

export function FullExample({ data = exampleOrders }: { data?: ExampleOrder[] }) {
  const [columnVisibility, onColumnVisibilityChange] = useState<ColumnVisibilityState>({});
  const table = useTable(
    {
      features: browserFeatures,
      columns,
      data,
      getRowId: (row) => row.id,
      defaultColumn: {
        size: 150,
        minSize: 60,
        maxSize: 500,
        filterFn: "includesString",
        sortFn: "text",
        sortDescFirst: false,
        enableGrouping: false,
        enableGlobalFilter: false,
      },
      globalFilterFn: "includesString",
      columnResizeMode: "onChange",
      groupedColumnMode: false,
      keepPinnedRows: false,
      enableRowSelection: (row) => !row.getIsGrouped(),
      enableSubRowSelection: false,
      enableRowPinning: (row) => !row.getIsGrouped(),
      state: { columnVisibility },
      onColumnVisibilityChange,
      initialState: { pagination: { pageIndex: 0, pageSize: 5 } },
    },
    () => null,
  ); // 구독을 compound 부품에 맡겨도 상태·options 갱신이 유지되어야 한다.
  return (
    <DataTable.Root table={table}>
      <div className="space-y-4">
        <DataTable.Toolbar>
          <DataTable.Search />
          <DataTable.Filter columnId="name" />
          <DataTable.Filter columnId="department" />
          <DataTable.Filter columnId="status" />
        </DataTable.Toolbar>
        <DataTable.Toolbar>
          <DataTable.Grouping />
          <DataTable.Selection />
        </DataTable.Toolbar>
        <DataTable.Columns />
        <DataTable.Table caption="15개 기능 조합 예제">
          <DataTable.Header />
          <DataTable.Body />
          <DataTable.Footer />
        </DataTable.Table>
        <DataTable.Pagination pageSizes={[5, 10, 20]} />
      </div>
    </DataTable.Root>
  );
}

const manualFeatures = tableFeatures({
  ...features,
  tableMeta: metaHelper<{ totals: number; facets: Array<[string, number]> }>(),
  facetedUniqueValues: (table) => () => new Map(table.options.meta?.facets ?? []),
});
const manualColumn = createColumnHelper<typeof manualFeatures, ExampleOrder>();
const manualColumns = manualColumn.columns([
  manualColumn.accessor("name", {
    header: "이름",
    filterFn: "includesString",
    enableGlobalFilter: true,
  }),
  manualColumn.accessor("department", {
    header: "부서",
    filterFn: "equalsString",
    meta: { filterVariant: "select" },
  }),
  manualColumn.accessor("amount", {
    header: "금액",
    sortFn: "basic",
    getAggregationValue: ({ table }) => ({ value: table.options.meta?.totals }),
    footer: ({ column }) => column.getAggregationValue<number>()?.toLocaleString("ko-KR"),
  }),
]);

export function ManualExample() {
  const [pagination, onPaginationChange] = useState<PaginationState>({ pageIndex: 0, pageSize: 5 });
  const table = useTable({
    features: manualFeatures,
    columns: manualColumns,
    data: exampleOrders.slice(0, 2),
    rowCount: 100,
    state: { pagination },
    onPaginationChange,
    getRowId: (row) => row.id,
    meta: {
      totals: 9990000,
      facets: [
        ["개발", 70],
        ["운영", 30],
      ],
    },
    defaultColumn: { sortFn: "text", enableGrouping: false },
    globalFilterFn: "includesString",
    manualFiltering: true,
    manualSorting: true,
    manualPagination: true,
    manualGrouping: true,
    manualAggregation: true,
    manualExpanding: true,
  });
  return (
    <DataTable.Root table={table}>
      <DataTable.Filter columnId="department" />
      <DataTable.Table caption="서버 응답 조합 예제">
        <DataTable.Header />
        <DataTable.Body />
        <DataTable.Footer />
      </DataTable.Table>
      <DataTable.Pagination />
    </DataTable.Root>
  );
}
