"use client";

import { useState } from "react";
import type { ComponentProps, ReactNode } from "react";

import {
  Button,
  buttonClass,
  columnLabel,
  inputClass,
  setColumnWidth,
  Snapshot,
  useTableContext,
} from "./context";

export function Toolbar({ className = "", ...props }: ComponentProps<"div">) {
  return <div {...props} className={`flex flex-wrap items-end gap-3 ${className}`} />;
}

export function Search({
  label = "전역 검색",
  submitLabel = "검색",
}: {
  label?: string;
  submitLabel?: string;
}) {
  const table = useTableContext();
  if (!table.options.features.globalFilteringFeature) return null;
  return (
    <Snapshot>
      {() => (
        <SearchForm
          key={String(table.store.get().globalFilter ?? "")}
          value={String(table.store.get().globalFilter ?? "")}
          label={label}
          submitLabel={submitLabel}
          onSubmit={(value) => {
            table.setGlobalFilter(value);
            if (table.options.features.rowPaginationFeature) table.setPageIndex(0);
          }}
        />
      )}
    </Snapshot>
  );
}

function SearchForm({
  value,
  label,
  submitLabel,
  onSubmit,
}: {
  value: string;
  label: string;
  submitLabel: string;
  onSubmit: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <form
      className="flex max-w-full flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(draft.trim());
      }}
    >
      <label className="grid min-w-0 gap-1 text-sm">
        {label}
        <input
          className={inputClass}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
          }}
        />
      </label>
      <Button type="submit" className={buttonClass}>
        {submitLabel}
      </Button>
    </form>
  );
}

export function Filter({ columnId }: { columnId: string }) {
  const table = useTableContext();
  if (!table.options.features.columnFilteringFeature) return null;
  return (
    <Snapshot>
      {() => {
        const column = table.getColumn(columnId);
        if (!column?.getCanFilter()) return null;
        const label = `${columnLabel(column)} 필터`;
        const value = String(column.getFilterValue() ?? "");
        const onChange = (next: string) => {
          column.setFilterValue(next || undefined);
          if (table.options.features.rowPaginationFeature) table.setPageIndex(0);
        };
        return (
          <label className="grid min-w-0 gap-1 text-sm">
            {label}
            {column.columnDef.meta?.filterVariant === "select" &&
            table.options.features.columnFacetingFeature ? (
              <select
                aria-label={label}
                className={inputClass}
                value={value}
                onChange={(event) => onChange(event.target.value)}
              >
                <option value="">전체</option>
                {[...column.getFacetedUniqueValues().entries()]
                  .sort(([a], [b]) => String(a).localeCompare(String(b)))
                  .map(([option, count]) => (
                    <option key={String(option)} value={String(option)}>
                      {String(option)} ({count})
                    </option>
                  ))}
              </select>
            ) : (
              <input
                aria-label={label}
                className={inputClass}
                value={value}
                onChange={(event) => onChange(event.target.value)}
              />
            )}
          </label>
        );
      }}
    </Snapshot>
  );
}

export function Grouping({ label = "그룹 기준" }: { label?: string }) {
  const table = useTableContext();
  if (!table.options.features.columnGroupingFeature) return null;
  return (
    <Snapshot>
      {() => (
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-1 text-sm">{label}</legend>
          {table
            .getAllLeafColumns()
            .filter((column) => column.getCanGroup())
            .map((column) => (
              <Button
                type="button"
                key={column.id}
                className={buttonClass}
                aria-pressed={column.getIsGrouped()}
                onClick={() => {
                  column.toggleGrouping();
                  if (table.options.features.rowPaginationFeature) table.setPageIndex(0);
                }}
              >
                {columnLabel(column)}
              </Button>
            ))}
        </fieldset>
      )}
    </Snapshot>
  );
}

export function Selection() {
  const table = useTableContext();
  if (!table.options.features.rowSelectionFeature) return null;
  return (
    <Snapshot>
      {() => (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={table.getIsAllPageRowsSelected()}
              aria-checked={
                table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected()
                  ? "mixed"
                  : table.getIsAllPageRowsSelected()
              }
              ref={(element) => {
                if (element)
                  element.indeterminate =
                    table.getIsSomePageRowsSelected() && !table.getIsAllPageRowsSelected();
              }}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
            />
            현재 페이지 선택
          </label>
          <output className="text-muted-foreground text-sm" aria-live="polite">
            {Object.values(table.store.get().rowSelection).filter(Boolean).length}개 선택
          </output>
          <Button
            type="button"
            className={buttonClass}
            onClick={() => table.resetRowSelection(true)}
          >
            선택 해제
          </Button>
        </div>
      )}
    </Snapshot>
  );
}

export function RowSelect({ rowId, label }: { rowId: string; label: string }) {
  const table = useTableContext();
  if (!table.options.features.rowSelectionFeature) return null;
  return (
    <Snapshot>
      {() => {
        const row = table.getRow(rowId);
        return (
          <label className="inline-flex min-h-9 min-w-9 items-center justify-center">
            <input
              type="checkbox"
              aria-label={label}
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
            />
          </label>
        );
      }}
    </Snapshot>
  );
}

export function RowPin({ rowId, label }: { rowId: string; label: string }) {
  const table = useTableContext();
  if (!table.options.features.rowPinningFeature) return null;
  return (
    <Snapshot>
      {() => {
        const row = table.getRow(rowId);
        return (
          <select
            aria-label={label}
            className={inputClass}
            disabled={!row.getCanPin()}
            value={row.getIsPinned() || ""}
            onChange={(event) =>
              row.pin(
                event.target.value === "top"
                  ? "top"
                  : event.target.value === "bottom"
                    ? "bottom"
                    : false,
              )
            }
          >
            <option value="">고정 안 함</option>
            <option value="top">위</option>
            <option value="bottom">아래</option>
          </select>
        );
      }}
    </Snapshot>
  );
}

export function ExpandRow({ rowId, label }: { rowId: string; label: string }) {
  const table = useTableContext();
  if (!table.options.features.rowExpandingFeature) return null;
  return (
    <Snapshot>
      {() => {
        const row = table.getRow(rowId);
        return (
          <Button
            type="button"
            className={buttonClass}
            aria-expanded={row.getIsExpanded()}
            disabled={!row.getCanExpand()}
            onClick={row.getToggleExpandedHandler()}
          >
            {label}
          </Button>
        );
      }}
    </Snapshot>
  );
}

function columnOrder(table: ReturnType<typeof useTableContext>) {
  const allIds = table.getAllLeafColumns().map((column) => column.id);
  return table.options.features.columnOrderingFeature
    ? [...new Set([...table.store.get().columnOrder, ...allIds])].filter((id) =>
        allIds.includes(id),
      )
    : allIds;
}

export function Columns({ children, label = "열 설정" }: { children?: ReactNode; label?: string }) {
  const table = useTableContext();
  return (
    <details className="max-w-full">
      <summary className="focus-visible:ring-ring min-h-9 cursor-pointer rounded-sm px-2 py-2 text-sm focus-visible:ring-2 focus-visible:outline-none">
        {label}
      </summary>
      {children ?? (
        <Snapshot>
          {() => (
            <div className="border-border grid max-h-80 gap-3 overflow-auto rounded-md border p-3">
              {columnOrder(table).map((id) => (
                <div key={id} className="flex flex-wrap items-center gap-2">
                  <ColumnVisibility columnId={id} />
                  <ColumnOrder columnId={id} />
                  <ColumnPin columnId={id} />
                  <ColumnWidth columnId={id} />
                </div>
              ))}
            </div>
          )}
        </Snapshot>
      )}
    </details>
  );
}

export function ColumnVisibility({ columnId }: { columnId: string }) {
  const table = useTableContext();
  return (
    <Snapshot>
      {() => {
        const column = table.getColumn(columnId);
        if (!column) return null;
        const label = columnLabel(column);
        return table.options.features.columnVisibilityFeature ? (
          <label className="flex min-h-9 items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={column.getIsVisible()}
              disabled={!column.getCanHide()}
              onChange={column.getToggleVisibilityHandler()}
            />
            {label}
          </label>
        ) : (
          <span className="text-sm">{label}</span>
        );
      }}
    </Snapshot>
  );
}

export function ColumnOrder({ columnId }: { columnId: string }) {
  const table = useTableContext();
  if (!table.options.features.columnOrderingFeature) return null;
  return (
    <Snapshot>
      {() => {
        const column = table.getColumn(columnId);
        if (!column) return null;
        const order = columnOrder(table),
          index = order.indexOf(columnId);
        const move = (offset: number) => {
          const next = [...order];
          [next[index], next[index + offset]] = [next[index + offset], next[index]];
          table.setColumnOrder(next);
        };
        return (
          <>
            <Button
              type="button"
              className={buttonClass}
              aria-label={`${columnLabel(column)} 앞으로`}
              disabled={index <= 0}
              onClick={() => move(-1)}
            >
              앞으로
            </Button>
            <Button
              type="button"
              className={buttonClass}
              aria-label={`${columnLabel(column)} 뒤로`}
              disabled={index < 0 || index === order.length - 1}
              onClick={() => move(1)}
            >
              뒤로
            </Button>
          </>
        );
      }}
    </Snapshot>
  );
}

export function ColumnPin({ columnId }: { columnId: string }) {
  const table = useTableContext();
  if (!table.options.features.columnPinningFeature) return null;
  return (
    <Snapshot>
      {() => {
        const column = table.getColumn(columnId);
        if (!column) return null;
        return (
          <select
            className={inputClass}
            aria-label={`${columnLabel(column)} 고정`}
            disabled={!column.getCanPin()}
            value={column.getIsPinned() || ""}
            onChange={(event) =>
              column.pin(
                event.target.value === "start"
                  ? "start"
                  : event.target.value === "end"
                    ? "end"
                    : false,
              )
            }
          >
            <option value="">고정 안 함</option>
            <option value="start">시작 고정</option>
            <option value="end">끝 고정</option>
          </select>
        );
      }}
    </Snapshot>
  );
}

export function ColumnWidth({ columnId }: { columnId: string }) {
  const table = useTableContext();
  if (!table.options.features.columnSizingFeature) return null;
  return (
    <Snapshot>
      {() => {
        const column = table.getColumn(columnId);
        if (!column) return null;
        return (
          <label className="flex items-center gap-2 text-sm">
            너비
            <input
              type="number"
              className={`${inputClass} w-24`}
              aria-label={`${columnLabel(column)} 너비`}
              min={column.columnDef.minSize ?? 20}
              max={column.columnDef.maxSize}
              value={Math.round(column.getSize())}
              onChange={(event) => setColumnWidth(column, Number(event.target.value))}
            />
          </label>
        );
      }}
    </Snapshot>
  );
}

export function Pagination({
  label = "목록 페이지",
  pageSizes,
}: {
  label?: string;
  pageSizes?: readonly number[];
}) {
  const table = useTableContext();
  if (!table.options.features.rowPaginationFeature) return null;
  return (
    <Snapshot>
      {() => {
        const pagination = table.store.get().pagination;
        const sizes = pageSizes
          ? [...new Set([...pageSizes, pagination.pageSize])]
              .filter((size) => Number.isInteger(size) && size > 0)
              .sort((a, b) => a - b)
          : [];
        return (
          <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-2">
            <Button
              type="button"
              className={buttonClass}
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              이전
            </Button>
            <span className="text-muted-foreground text-sm tabular-nums" aria-live="polite">
              {pagination.pageIndex + 1} / {Math.max(1, table.getPageCount())}
            </span>
            <Button
              type="button"
              className={buttonClass}
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              다음
            </Button>
            {pageSizes && (
              <label className="flex items-center gap-2 text-sm">
                페이지당 행
                <select
                  aria-label="페이지당 행"
                  className={inputClass}
                  value={pagination.pageSize}
                  onChange={(event) =>
                    table.setPagination({ pageIndex: 0, pageSize: Number(event.target.value) })
                  }
                >
                  {sizes.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </nav>
        );
      }}
    </Snapshot>
  );
}
