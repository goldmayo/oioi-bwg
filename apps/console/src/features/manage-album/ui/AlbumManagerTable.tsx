"use client";

import { useMemo } from "react";
import { DataTable } from "@oioi-bwg/ui/data-table";
import { Edit, Trash2 } from "lucide-react";

import type { AdminAlbumSummary } from "@/entities/album";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { createAppColumnHelper, dataTableComponents, useAppTable } from "@/shared/ui/data-table";

interface Props {
  albums: AdminAlbumSummary[];
  canManage: boolean;
  hasFilter: boolean;
  onEdit: (album: AdminAlbumSummary) => void;
  onDelete: (album: AdminAlbumSummary) => void;
}
const column = createAppColumnHelper<AdminAlbumSummary>();

export function AlbumManagerTable({ albums, canManage, hasFilter, onEdit, onDelete }: Props) {
  "use no memo";
  // AppTable은 내부 ref로 options를 읽는다. 자동 memo가 권한/DTO 변경 렌더를 건너뛰지 않게 한다.
  const columns = useMemo(
    () =>
      column.columns([
        column.accessor("name", {
          header: "이름",
          meta: { className: "font-medium whitespace-normal" },
          cell: ({ row: { original: album } }) => (
            <span className="block break-words">{album.name}</span>
          ),
        }),
        column.accessor("slug", {
          header: "Slug",
          meta: {
            className: "hidden lg:table-cell text-muted-foreground text-xs w-44",
          },
          cell: ({ row: { original: album } }) => (
            <span className="block truncate" title={album.slug}>
              {album.slug}
            </span>
          ),
        }),
        column.accessor("color", {
          header: "색상",
          meta: { className: "w-16" },
          cell: ({ row: { original: album } }) => (
            <>
              <div
                className="h-5 w-5 rounded-md border"
                style={{ backgroundColor: album.color }}
                title={album.color}
              />
            </>
          ),
          enableSorting: false,
        }),
        column.accessor("isVisible", {
          header: "표시",
          meta: { className: "w-16 text-center" },
          cell: ({ row: { original: album } }) => (
            <>
              <Badge
                variant={album.isVisible ? "default" : "outline"}
                className="px-2 py-0.5 text-xs"
              >
                {album.isVisible ? "표시" : "숨김"}
              </Badge>
            </>
          ),
          enableSorting: false,
        }),
        column.accessor("releaseDate", {
          header: "발매일",
          meta: {
            className: "hidden xl:table-cell text-muted-foreground text-sm w-32",
          },
          cell: ({ row: { original: album } }) => (
            <>{album.releaseDate ? new Date(album.releaseDate).toLocaleDateString("ko-KR") : "-"}</>
          ),
        }),
        column.display({
          id: "actions",
          header: "관리",
          meta: { className: "w-24 text-right" },
          cell: ({ row: { original: album } }) => (
            <>
              {canManage && (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(album)}
                    title="수정"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => onDelete(album)}
                    title="삭제"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </>
          ),
        }),
      ]),
    [canManage, onEdit, onDelete],
  );
  const table = useAppTable({
    columns,
    data: albums,
    getRowId: (row) => String(row.id),
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <DataTable.Root table={table} components={dataTableComponents}>
      <div className="min-w-0 space-y-4">
        <DataTable.Table
          caption="앨범 관리 목록"
          className="bg-card table-fixed [&_td]:px-3 [&_td]:py-3 [&_th]:px-3"
        >
          <DataTable.Header />
          <DataTable.Body
            emptyState={<>{hasFilter ? "검색 결과가 없습니다." : "등록된 앨범이 없습니다."}</>}
          />
        </DataTable.Table>
        <DataTable.Pagination label="앨범 목록 페이지" />
      </div>
    </DataTable.Root>
  );
}
