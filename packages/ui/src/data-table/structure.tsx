"use client";

import { useContext, type ComponentProps, type ReactNode } from "react";
import { flexRender, FlexRender } from "@tanstack/react-table";

import {
  Button,
  columnLabel,
  columnStyle,
  fillWidthContext,
  isFillColumn,
  ResizeHandleIcon,
  setColumnWidth,
  Snapshot,
  useTableContext,
} from "./context";

const sortJustification = { start: "flex-start", center: "center", end: "flex-end" };
const sortAria = { asc: "ascending", desc: "descending" } as const;
const sortPaths = {
  asc: "M2 10l4-5 4 5",
  desc: "M2 5l4 5 4-5",
  none: "M2 6l4-4 4 4M2 10l4 4 4-4",
};

export function Table({
  caption,
  fillWidth = false,
  viewportClassName = "",
  children,
  className = "",
  ...props
}: ComponentProps<"table"> & { caption: string; fillWidth?: boolean; viewportClassName?: string }) {
  const table = useTableContext();
  return (
    <fillWidthContext.Provider value={fillWidth}>
      <div
        className={`border-border max-w-full overflow-auto rounded-lg border ${table.options.features.columnSizingFeature && !fillWidth ? "w-fit" : "w-full"} ${viewportClassName}`}
      >
        <Snapshot>
          {() => (
            <table
              {...props}
              className={`w-full text-sm tabular-nums ${className}`}
              style={{
                width:
                  table.options.features.columnSizingFeature && !fillWidth
                    ? table.getTotalSize()
                    : undefined,
                minWidth:
                  table.options.features.columnSizingFeature && fillWidth
                    ? table.getTotalSize()
                    : undefined,
                ...props.style,
              }}
            >
              <caption className="sr-only">{caption}</caption>
              {fillWidth && table.options.features.columnSizingFeature && (
                <colgroup>
                  {(table.options.features.columnVisibilityFeature
                    ? table.getVisibleLeafColumns()
                    : table.getAllLeafColumns()
                  ).map((column, index, columns) => (
                    <col
                      key={column.id}
                      style={{ width: index === columns.length - 1 ? undefined : column.getSize() }}
                    />
                  ))}
                </colgroup>
              )}
              {children}
            </table>
          )}
        </Snapshot>
      </div>
    </fillWidthContext.Provider>
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
      className={`group/column relative h-10 px-2 text-left align-middle font-medium whitespace-nowrap ${className}`}
    />
  );
}

export function Header({ children }: { children?: ReactNode }) {
  const table = useTableContext();
  const fillWidth = useContext(fillWidthContext);
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
                  const resizable =
                    table.options.features.columnResizingFeature &&
                    column.getCanResize() &&
                    !header.getLeafHeaders().some((leaf) => isFillColumn(leaf.column, fillWidth));
                  return (
                    <th
                      key={header.id}
                      scope={header.subHeaders.length ? "colgroup" : "col"}
                      colSpan={header.colSpan}
                      className={`group/column relative h-10 px-2 text-left align-middle font-medium whitespace-nowrap ${column.columnDef.meta?.className ?? ""}`}
                      style={{
                        ...columnStyle(column, fillWidth),
                        paddingInlineEnd:
                          resizable && column.columnDef.meta?.align === "end" ? 44 : undefined,
                      }}
                      aria-sort={sorted ? sortAria[sorted] : undefined}
                    >
                      {!header.isPlaceholder && (
                        <>
                          {sorting && column.getCanSort() ? (
                            <Button
                              type="button"
                              className="focus-visible:ring-ring relative inline-flex min-h-10 w-full items-center gap-1 rounded-sm px-0 focus-visible:ring-2 focus-visible:outline-none has-[>svg]:px-0"
                              style={{
                                justifyContent:
                                  sortJustification[column.columnDef.meta?.align ?? "start"],
                              }}
                              onClick={column.getToggleSortingHandler()}
                            >
                              <span className="relative inline-flex min-w-0 items-center">
                                <FlexRender header={header} />
                                <svg
                                  className="absolute start-full ms-1 size-3 shrink-0"
                                  aria-hidden="true"
                                  width="12"
                                  height="16"
                                  viewBox="0 0 12 16"
                                  fill="none"
                                  stroke="currentColor"
                                >
                                  <path d={sortPaths[sorted || "none"]} />
                                </svg>
                              </span>
                            </Button>
                          ) : (
                            <FlexRender header={header} />
                          )}
                          {resizable && (
                            <Button
                              type="button"
                              role="separator"
                              tabIndex={0}
                              aria-label={`${columnLabel(column)} 크기 조절`}
                              aria-orientation="vertical"
                              aria-valuenow={Math.round(column.getSize())}
                              aria-valuemin={column.columnDef.minSize ?? 20}
                              aria-valuemax={column.columnDef.maxSize}
                              data-resizing={column.getIsResizing() ? "" : undefined}
                              className="text-muted-foreground hover:text-foreground hover:bg-accent focus-visible:ring-ring absolute top-1/2 right-0 inline-flex h-8 w-6 -translate-y-1/2 cursor-col-resize touch-none items-center justify-center rounded-sm p-0 opacity-0 group-hover/column:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:outline-none data-resizing:opacity-100"
                              onClick={(event) => event.stopPropagation()}
                              onMouseDown={header.getResizeHandler()}
                              onTouchStart={header.getResizeHandler()}
                              onKeyDown={(event) => {
                                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                                event.preventDefault();
                                const direction =
                                  table.options.columnResizeDirection === "rtl" ? -1 : 1;
                                setColumnWidth(
                                  column,
                                  column.getSize() +
                                    (event.key === "ArrowRight" ? 10 : -10) * direction,
                                );
                              }}
                            >
                              <ResizeHandleIcon />
                            </Button>
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
  padToPageSize = false,
  children,
}: {
  emptyState?: ReactNode;
  padToPageSize?: boolean;
  children?: ReactNode;
}) {
  const table = useTableContext();
  const fillWidth = useContext(fillWidthContext);
  return (
    <Snapshot>
      {() => {
        const features = table.options.features;
        if (children != null) return <tbody>{children}</tbody>;
        const regions = features.rowPinningFeature
          ? [table.getTopRows(), table.getCenterRows(), table.getBottomRows()]
          : [table.getRowModel().rows];
        const rowCount = regions.reduce((count, rows) => count + rows.length, 0);
        const paddingRows =
          padToPageSize && features.rowPaginationFeature
            ? Math.max(0, table.store.get().pagination.pageSize - Math.max(1, rowCount))
            : 0;
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
                      style={columnStyle(cell.column, fillWidth)}
                      className={`p-2 align-middle whitespace-nowrap ${cell.column.columnDef.meta?.className ?? ""}`}
                    >
                      {features.columnGroupingFeature && cell.getIsGrouped() ? (
                        <Button
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
                        </Button>
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
            {rowCount === 0 && (
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
            {paddingRows > 0 && (
              <tr aria-hidden="true" data-table-padding="true">
                <td
                  colSpan={
                    features.columnVisibilityFeature
                      ? table.getVisibleLeafColumns().length
                      : table.getAllLeafColumns().length
                  }
                  style={{
                    height: `calc(var(--data-table-row-height, 3.5rem) * ${paddingRows})`,
                    padding: 0,
                  }}
                />
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
  const fillWidth = useContext(fillWidthContext);
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
                    style={columnStyle(footer.column, fillWidth)}
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
