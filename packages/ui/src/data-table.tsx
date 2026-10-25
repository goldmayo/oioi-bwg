"use client";

import type { ReactNode } from "react";
import {
  createTableHook,
  createPaginatedRowModel,
  createSortedRowModel,
  metaHelper,
  rowPaginationFeature,
  rowSortingFeature,
  sortFn_basic,
  sortFn_text,
  tableFeatures,
} from "@tanstack/react-table";

const features = tableFeatures({
  rowSortingFeature,
  rowPaginationFeature,
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  sortFns: { text: sortFn_text, basic: sortFn_basic },
  columnMeta: metaHelper<{ className?: string }>(),
});

// 공식 factory의 열/옵션/인스턴스를 그대로 노출한다. 전건을 가진 client 목록 전용이다.
export const { useAppTable, createAppColumnHelper, useTableContext } = createTableHook({
  features,
  defaultColumn: { sortFn: "text", sortDescFirst: false },
  tableComponents: { Body, Pagination },
});

function Body({ caption, emptyState }: { caption: string; emptyState: ReactNode }) {
  const table = useTableContext();
  return (
    <table.Subscribe selector={(s) => ({ sorting: s.sorting, pagination: s.pagination })}>
      {() => (
        <div className="border-border overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <caption className="sr-only">{caption}</caption>
            <thead>
              {table.getHeaderGroups().map((group) => (
                <tr key={group.id} className="bg-muted/50 border-b">
                  {group.headers.map((header) => {
                    const sorted = header.column.getIsSorted();
                    return (
                      <th
                        key={header.id}
                        scope="col"
                        colSpan={header.colSpan}
                        className={`h-10 px-2 text-left align-middle font-medium whitespace-nowrap ${header.column.columnDef.meta?.className ?? ""}`}
                        aria-sort={
                          sorted === "asc"
                            ? "ascending"
                            : sorted === "desc"
                              ? "descending"
                              : undefined
                        }
                      >
                        {!header.isPlaceholder &&
                          (header.column.getCanSort() ? (
                            <button
                              type="button"
                              className="focus-visible:ring-ring inline-flex min-h-10 items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                              onClick={header.column.getToggleSortingHandler()}
                            >
                              <table.FlexRender header={header} />
                              <span aria-hidden="true" className="text-muted-foreground">
                                {sorted === "asc" ? "↑" : sorted === "desc" ? "↓" : "↕"}
                              </span>
                            </button>
                          ) : (
                            <table.FlexRender header={header} />
                          ))}
                      </th>
                    );
                  })}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={table.getAllColumns().length}
                    className="text-muted-foreground py-8 text-center"
                  >
                    {emptyState}
                  </td>
                </tr>
              ) : (
                table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-accent/30 border-b transition-colors last:border-0"
                  >
                    {row.getAllCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`p-2 align-middle whitespace-nowrap ${cell.column.columnDef.meta?.className ?? ""}`}
                      >
                        <table.FlexRender cell={cell} />
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </table.Subscribe>
  );
}

function Pagination({ label = "목록 페이지" }: { label?: string }) {
  const table = useTableContext();
  return (
    <table.Subscribe selector={(s) => s.pagination}>
      {(pagination) => (
        <nav aria-label={label} className="flex items-center justify-center gap-2">
          <button
            type="button"
            className="border-input focus-visible:ring-ring min-h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            disabled={!table.getCanPreviousPage()}
            onClick={() => table.previousPage()}
          >
            이전
          </button>
          <span className="text-muted-foreground text-sm" aria-live="polite">
            {pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
          </span>
          <button
            type="button"
            className="border-input focus-visible:ring-ring min-h-9 rounded-md border px-3 text-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
            disabled={!table.getCanNextPage()}
            onClick={() => table.nextPage()}
          >
            다음
          </button>
        </nav>
      )}
    </table.Subscribe>
  );
}
