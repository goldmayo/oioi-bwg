"use client";

import { useMemo } from "react";
import type { Notification } from "@oioi-bwg/contracts/notification";
import { DataTable } from "@oioi-bwg/ui/data-table";
import type { OnChangeFn, PaginationState } from "@tanstack/react-table";
import { ArrowUpRight, CircleCheckBig, CircleX, Loader2 } from "lucide-react";

import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Button } from "@/shared/ui/button";
import {
  AppDataTable,
  createAppColumnHelper,
  dataTableComponents,
  useAppTable,
} from "@/shared/ui/data-table";

import { formatNotificationTime } from "../_lib/notification-time";

const column = createAppColumnHelper<Notification>();
export function NotificationTable({
  items,
  totalCount,
  pagination,
  onPaginationChange,
  onOpen,
  pending,
  loading,
  ready,
  hasFilter,
}: {
  items: Notification[];
  totalCount: number;
  pagination: PaginationState;
  onPaginationChange: OnChangeFn<PaginationState>;
  onOpen: (id: string) => void;
  pending: boolean;
  loading: boolean;
  ready: boolean;
  hasFilter: boolean;
}) {
  "use no memo";
  const wide = useMediaQuery("(min-width: 768px)");
  const columns = useMemo(
    () =>
      column.columns([
        column.accessor("readAt", {
          header: "STATUS",
          size: 112,
          minSize: 96,
          meta: { align: "center" },
          cell: ({ row }) => (
            <span
              className={`text-sm ${row.original.readAt ? "text-muted-foreground" : "text-foreground font-medium"}`}
            >
              {row.original.readAt ? "READ" : "UNREAD"}
            </span>
          ),
        }),
        column.accessor("title", {
          header: "알림 내용",
          size: wide ? 560 : 236,
          minSize: 200,
          cell: ({ row: { original: item } }) => {
            const Icon = item.type === "WAVEFORM_FAILED" ? CircleX : CircleCheckBig;
            return (
              <button
                type="button"
                disabled={pending}
                className="focus-visible:outline-ring flex min-h-11 w-full min-w-0 items-center gap-3 rounded-sm text-left underline-offset-4 outline-none hover:underline focus-visible:outline-2 disabled:opacity-60"
              >
                <Icon
                  className={`size-4 shrink-0 ${item.type === "WAVEFORM_FAILED" ? "text-destructive" : "text-success"}`}
                  aria-label={item.type === "WAVEFORM_FAILED" ? "실패" : "성공"}
                />
                <span className="min-w-0">
                  <span
                    className={`block truncate text-sm ${item.readAt ? "text-muted-foreground" : "text-foreground font-medium"}`}
                  >
                    {item.title}
                  </span>
                  {!wide && (
                    <time
                      dateTime={item.createdAt}
                      className="text-muted-foreground mt-0.5 block text-xs"
                    >
                      {formatNotificationTime(item.createdAt)}
                    </time>
                  )}
                </span>
              </button>
            );
          },
        }),
        column.accessor("createdAt", {
          header: "받은 시간",
          size: 210,
          minSize: 190,
          meta: { align: "center" },
          cell: ({ row }) => (
            <time
              dateTime={row.original.createdAt}
              className="text-muted-foreground text-sm tabular-nums"
            >
              {formatNotificationTime(row.original.createdAt)}
            </time>
          ),
        }),
        column.display({
          id: "action",
          header: "작업 결과",
          size: 110,
          minSize: 96,
          enableResizing: false,
          meta: { align: "end", className: "pr-5!" },
          cell: () => (
            <Button type="button" variant="ghost" size="sm" disabled={pending}>
              보기
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </Button>
          ),
        }),
      ]),
    [wide, pending],
  );
  const table = useAppTable({
    columns,
    data: items,
    rowCount: totalCount,
    manualPagination: true,
    state: { pagination, columnVisibility: { createdAt: wide, action: wide } },
    onPaginationChange,
    enableRowSelection: false,
    enableSorting: false,
    getRowId: (item) => item.id,
  });
  let emptyState = (
    <span>{hasFilter ? "조건에 맞는 알림이 없습니다." : "아직 알림이 없습니다."}</span>
  );
  if (loading)
    emptyState = (
      <span role="status" className="inline-flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        알림을 불러오고 있습니다.
      </span>
    );

  return (
    <DataTable.Root table={table} components={dataTableComponents}>
      <div className="min-w-0 space-y-4" aria-busy={loading || pending}>
        <AppDataTable
          caption="알림 내역 목록"
          className="[&_tbody_tr[data-row-id]]:cursor-pointer"
          onClick={(event) => {
            if (pending) return;
            const row =
              event.target instanceof Element
                ? event.target.closest("tbody tr[data-row-id]")
                : null;
            const id = row?.getAttribute("data-row-id");
            if (id) onOpen(id);
          }}
        >
          <DataTable.Header />
          <DataTable.Body padToPageSize emptyState={emptyState} />
        </AppDataTable>
        <div className="min-h-9">
          {ready &&
            (totalCount > pagination.pageIndex * pagination.pageSize ||
              pagination.pageIndex === 0) && (
              <DataTable.Pagination label="알림 목록 페이지" pageSizes={[10, 20, 50]} />
            )}
        </div>
      </div>
    </DataTable.Root>
  );
}
