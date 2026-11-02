"use client";

import { useMemo } from "react";
import { DataTable } from "@oioi-bwg/ui/data-table";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";

import type { AdminAlbumSummary } from "@/entities/album";

import { formatDate } from "@/shared/lib/utils";
import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  AppDataTable,
  createAppColumnHelper,
  dataTableComponents,
  useAppTable,
} from "@/shared/ui/data-table";
import {
  TableActionsHeader,
  TableDeleteAction,
  TableEditAction,
  TableRowActions,
} from "@/shared/ui/table-row-actions";
import { VisibilityIcon } from "@/shared/ui/visibility-icon";

interface Props {
  albums: AdminAlbumSummary[];
  selection: RowSelectionState;
  onSelectionChange: OnChangeFn<RowSelectionState>;
  canManage: boolean;
  hasFilter: boolean;
  onEdit: (album: AdminAlbumSummary) => void;
  onDelete: (album: AdminAlbumSummary) => void;
}
const column = createAppColumnHelper<AdminAlbumSummary>();

export function AlbumManagerTable({
  albums,
  selection,
  onSelectionChange,
  canManage,
  hasFilter,
  onEdit,
  onDelete,
}: Props) {
  "use no memo";
  // AppTable은 내부 ref로 options를 읽는다. 자동 memo가 권한/DTO 변경 렌더를 건너뛰지 않게 한다.
  const showSlug = useMediaQuery("(min-width: 1024px)");
  const showReleaseDate = useMediaQuery("(min-width: 1280px)");
  const columns = useMemo(
    () =>
      column.columns([
        column.display({
          id: "selection",
          header: "선택",
          size: 56,
          minSize: 48,
          enableResizing: false,
          meta: { align: "center" },
          cell: ({ row }) => (
            <Checkbox
              aria-label={`${row.original.name} 선택`}
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            />
          ),
        }),
        column.accessor("name", {
          header: "이름",
          size: 280,
          minSize: 160,
          meta: { className: "font-medium whitespace-normal" },
          cell: ({ row: { original: album } }) => (
            <span className="block truncate" title={album.name}>
              {album.name}
            </span>
          ),
        }),
        column.accessor("slug", {
          header: "Slug",
          size: 176,
          minSize: 120,
          meta: {
            className: "text-muted-foreground text-xs",
          },
          cell: ({ row: { original: album } }) => (
            <span className="block truncate" title={album.slug}>
              {album.slug}
            </span>
          ),
        }),
        column.accessor("color", {
          header: "색상",
          meta: { align: "center" },
          size: 64,
          cell: ({ row: { original: album } }) => (
            <>
              <div
                className="mx-auto h-5 w-5 rounded-md border"
                style={{ backgroundColor: album.color }}
                title={album.color}
              />
            </>
          ),
          enableSorting: false,
        }),
        column.accessor("isVisible", {
          header: "표시",
          size: 80,
          minSize: 80,
          meta: { align: "center" },
          cell: ({ row: { original: album } }) => <VisibilityIcon visible={album.isVisible} />,
          enableSorting: false,
        }),
        column.accessor("releaseDate", {
          header: "발매일",
          size: 128,
          minSize: 112,
          meta: {
            align: "center",
            className: "text-muted-foreground text-sm",
          },
          cell: ({ row: { original: album } }) => <>{formatDate(album.releaseDate)}</>,
        }),
        column.display({
          id: "actions",
          enableResizing: false,
          header: () => <TableActionsHeader />,
          size: 72,
          minSize: 72,
          meta: { align: "end", label: "관리", className: "pr-5!" },
          cell: ({ row: { original: album } }) =>
            canManage && (
              <TableRowActions label={album.name}>
                <TableEditAction onClick={() => onEdit(album)} />
                <TableDeleteAction onClick={() => onDelete(album)} />
              </TableRowActions>
            ),
        }),
      ]),
    [canManage, onEdit, onDelete],
  );
  const table = useAppTable({
    columns,
    data: albums,
    state: {
      rowSelection: selection,
      columnVisibility: { slug: showSlug, releaseDate: showReleaseDate },
    },
    onRowSelectionChange: onSelectionChange,
    enableRowSelection: canManage,
    getRowId: (row) => String(row.id),
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <DataTable.Root table={table} components={dataTableComponents}>
      <div className="min-w-0 space-y-4">
        <AppDataTable caption="앨범 관리 목록">
          <DataTable.Header />
          <DataTable.Body
            padToPageSize
            emptyState={<>{hasFilter ? "검색 결과가 없습니다." : "등록된 앨범이 없습니다."}</>}
          />
        </AppDataTable>
        <DataTable.Pagination label="앨범 목록 페이지" pageSizes={[10, 20, 50]} />
      </div>
    </DataTable.Root>
  );
}
