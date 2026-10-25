"use client";

import type { ComponentProps, ReactNode } from "react";
import { flexRender, FlexRender } from "@tanstack/react-table";

import { columnLabel, columnStyle, setColumnWidth, Snapshot, useTableContext } from "./context";

export function Table({
  caption,
  children,
  className = "",
  ...props
}: ComponentProps<"table"> & { caption: string }) {
  const table = useTableContext();
  return (
    <div
      className={`border-border max-w-full overflow-x-auto rounded-lg border ${table.options.features.columnSizingFeature ? "w-fit" : ""}`}
    >
      <Snapshot>
        {() => (
          <table
            {...props}
            className={`w-full text-sm tabular-nums ${className}`}
            style={{
              width: table.options.features.columnSizingFeature ? table.getTotalSize() : undefined,
              ...props.style,
            }}
          >
            <caption className="sr-only">{caption}</caption>
            {children}
          </table>
        )}
      </Snapshot>
    </div>
  );
}

export function Row({ className = "", ...props }: ComponentProps<"tr">) {
  return (
    <tr
      {...props}
      className={`hover:bg-accent/30 border-b transition-colors last:border-0 ${className}`}
    />
  );
}

export function Cell({ className = "", ...props }: ComponentProps<"td">) {
  return <td {...props} className={`p-2 align-middle whitespace-nowrap ${className}`} />;
}

export function Head({ className = "", ...props }: ComponentProps<"th">) {
  return (
    <th
      scope="col"
      {...props}
      className={`relative h-10 px-2 text-left align-middle font-medium whitespace-nowrap ${className}`}
    />
  );
}

export function Header({ children }: { children?: ReactNode }) {
  const table = useTableContext();
  return (
    <Snapshot>
      {() => (
        <thead>
          {children ??
            table.getHeaderGroups().map((group) => (
              <tr key={group.id} className="bg-muted/50 border-b">
                {group.headers.map((header) => {
                  const column = header.column;
                  const sorting = table.options.features.rowSortingFeature;
                  const sorted = sorting ? column.getIsSorted() : false;
                  return (
                    <th
                      key={header.id}
                      scope={header.subHeaders.length ? "colgroup" : "col"}
                      colSpan={header.colSpan}
                      className={`relative h-10 px-2 text-left align-middle font-medium whitespace-nowrap ${column.columnDef.meta?.className ?? ""}`}
                      style={columnStyle(column)}
                      aria-sort={
                        sorted === "asc"
                          ? "ascending"
                          : sorted === "desc"
                            ? "descending"
                            : undefined
                      }
                    >
                      {!header.isPlaceholder && (
                        <>
                          {sorting && column.getCanSort() ? (
                            <button
                              type="button"
                              className="focus-visible:ring-ring inline-flex min-h-10 items-center gap-1 rounded-sm focus-visible:ring-2 focus-visible:outline-none"
                              onClick={column.getToggleSortingHandler()}
                            >
                              <FlexRender header={header} />
                              <svg
                                aria-hidden="true"
                                width="12"
                                height="16"
                                viewBox="0 0 12 16"
                                fill="none"
                                stroke="currentColor"
                              >
                                <path
                                  d={
                                    sorted === "desc"
                                      ? "M2 5l4 5 4-5"
                                      : sorted === "asc"
                                        ? "M2 10l4-5 4 5"
                                        : "M2 6l4-4 4 4M2 10l4 4 4-4"
                                  }
                                />
                              </svg>
                            </button>
                          ) : (
                            <FlexRender header={header} />
                          )}
                          {table.options.features.columnResizingFeature &&
                            column.getCanResize() && (
                              <div
                                role="separator"
                                tabIndex={0}
                                aria-label={`${columnLabel(column)} 크기 조절`}
                                aria-orientation="vertical"
                                aria-valuenow={Math.round(column.getSize())}
                                aria-valuemin={column.columnDef.minSize ?? 20}
                                aria-valuemax={column.columnDef.maxSize}
                                className="hover:bg-primary/30 focus-visible:bg-primary/30 focus-visible:ring-ring absolute inset-y-0 right-0 w-2 cursor-col-resize touch-none focus-visible:ring-2 focus-visible:outline-none"
                                onMouseDown={header.getResizeHandler()}
                                onTouchStart={header.getResizeHandler()}
                                onKeyDown={(event) => {
                                  if (event.key !== "ArrowLeft" && event.key !== "ArrowRight")
                                    return;
                                  event.preventDefault();
                                  const direction =
                                    table.options.columnResizeDirection === "rtl" ? -1 : 1;
                                  setColumnWidth(
                                    column,
                                    column.getSize() +
                                      (event.key === "ArrowRight" ? 10 : -10) * direction,
                                  );
                                }}
                              />
                            )}
                        </>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
        </thead>
      )}
    </Snapshot>
  );
}

export function Body({
  emptyState = "검색 결과가 없습니다.",
  children,
}: {
  emptyState?: ReactNode;
  children?: ReactNode;
}) {
  const table = useTableContext();
  return (
    <Snapshot>
      {() => {
        const features = table.options.features;
        if (children != null) return <tbody>{children}</tbody>;
        const regions = features.rowPinningFeature
          ? [table.getTopRows(), table.getCenterRows(), table.getBottomRows()]
          : [table.getRowModel().rows];
        return (
          <tbody>
            {regions.flatMap((rows, region) =>
              rows.map((row) => (
                <tr
                  key={row.id}
                  data-row-id={row.id}
                  data-region={region}
                  className="hover:bg-accent/30 border-b transition-colors last:border-0"
                >
                  {(features.columnVisibilityFeature
                    ? row.getVisibleCells()
                    : features.columnPinningFeature
                      ? [
                          ...row.getStartVisibleCells(),
                          ...row.getCenterVisibleCells(),
                          ...row.getEndVisibleCells(),
                        ]
                      : row.getAllCells()
                  ).map((cell) => (
                    <td
                      key={cell.id}
                      style={columnStyle(cell.column)}
                      className={`p-2 align-middle whitespace-nowrap ${cell.column.columnDef.meta?.className ?? ""}`}
                    >
                      {features.columnGroupingFeature && cell.getIsGrouped() ? (
                        <button
                          type="button"
                          className="focus-visible:ring-ring min-h-9 rounded-sm px-1 focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
                          disabled={!features.rowExpandingFeature || !row.getCanExpand()}
                          aria-label={`${String(cell.getValue())} 그룹 펼침`}
                          aria-expanded={
                            features.rowExpandingFeature ? row.getIsExpanded() : undefined
                          }
                          onClick={
                            features.rowExpandingFeature
                              ? row.getToggleExpandedHandler()
                              : undefined
                          }
                        >
                          {String(cell.getValue())} ({row.subRows.length})
                        </button>
                      ) : features.rowAggregationFeature && cell.getIsAggregated() ? (
                        flexRender(cell.column.columnDef.aggregatedCell, cell.getContext())
                      ) : features.columnGroupingFeature && cell.getIsPlaceholder() ? null : (
                        <FlexRender cell={cell} />
                      )}
                    </td>
                  ))}
                </tr>
              )),
            )}
            {regions.every((rows) => rows.length === 0) && (
              <tr>
                <td
                  className="text-muted-foreground py-8 text-center"
                  colSpan={Math.max(
                    1,
                    features.columnVisibilityFeature
                      ? table.getVisibleLeafColumns().length
                      : table.getAllLeafColumns().length,
                  )}
                >
                  {emptyState}
                </td>
              </tr>
            )}
          </tbody>
        );
      }}
    </Snapshot>
  );
}

export function Footer({ children }: { children?: ReactNode }) {
  const table = useTableContext();
  return (
    <Snapshot>
      {() => (
        <tfoot className="bg-muted/30 border-t font-medium">
          {children ??
            table.getFooterGroups().map((group) => (
              <tr key={group.id}>
                {group.headers.map((footer) => (
                  <td
                    key={footer.id}
                    colSpan={footer.colSpan}
                    style={columnStyle(footer.column)}
                    className={`p-2 ${footer.column.columnDef.meta?.className ?? ""}`}
                  >
                    {footer.isPlaceholder ? null : <FlexRender footer={footer} />}
                  </td>
                ))}
              </tr>
            ))}
        </tfoot>
      )}
    </Snapshot>
  );
}
