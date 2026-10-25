"use client";

import { useMemo } from "react";
import { DataTable } from "@oioi-bwg/ui/data-table";
import { Edit, FileMusic, Trash2 } from "lucide-react";
import Link from "next/link";

import type { AdminSongSummary } from "@/entities/song";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { createAppColumnHelper, dataTableComponents, useAppTable } from "@/shared/ui/data-table";

interface Props {
  songs: AdminSongSummary[];
  canManage: boolean;
  hasFilter: boolean;
  onEdit: (song: AdminSongSummary) => void;
  onDelete: (song: AdminSongSummary) => void;
}
const column = createAppColumnHelper<AdminSongSummary>();

export function SongManagerTable({ songs, canManage, hasFilter, onEdit, onDelete }: Props) {
  "use no memo";
  // AppTable은 내부 ref로 options를 읽는다. 자동 memo가 권한/DTO 변경 렌더를 건너뛰지 않게 한다.
  const columns = useMemo(
    () =>
      column.columns([
        column.accessor("id", {
          header: "ID",
          meta: { className: "w-12 text-muted-foreground text-xs" },
          cell: ({ row: { original: song } }) => <>{song.id}</>,
          sortFn: "basic",
        }),
        column.accessor("title", {
          header: "제목",
          meta: { className: "font-medium" },
          cell: ({ row: { original: song } }) => (
            <>
              {song.slug === null ? (
                song.title
              ) : (
                <Link
                  href={`/admin/edit/${song.slug}`}
                  className="text-primary hover:underline"
                  prefetch={false}
                >
                  {song.title}
                </Link>
              )}
            </>
          ),
        }),
        column.accessor((row) => row.album.name, {
          id: "album",
          header: "앨범",
          meta: {
            className: "hidden sm:table-cell text-muted-foreground text-sm",
          },
          cell: ({ row: { original: song } }) => <>{song.album.name}</>,
        }),
        column.accessor("slug", {
          header: "Slug",
          meta: {
            className: "hidden lg:table-cell text-muted-foreground text-sm",
          },
          cell: ({ row: { original: song } }) => <>{song.slug ?? "미지정"}</>,
        }),
        column.display({
          id: "type",
          header: "구분",
          meta: { className: "w-20 text-center" },
          cell: ({ row: { original: song } }) => (
            <>
              <div className="flex flex-wrap justify-center gap-1">
                {song.isTitle && (
                  <Badge variant="default" className="text-2xs px-1.5 py-0">
                    타이틀
                  </Badge>
                )}
                {song.hasOfficialCheer && (
                  <Badge variant="secondary" className="text-2xs px-1.5 py-0">
                    응원법
                  </Badge>
                )}
                {!song.isVisible && (
                  <Badge variant="outline" className="text-2xs text-muted-foreground px-1.5 py-0">
                    숨김
                  </Badge>
                )}
              </div>
            </>
          ),
        }),
        column.accessor("order", {
          header: "순서",
          meta: {
            className:
              "hidden w-16 text-center md:table-cell text-muted-foreground hidden text-center text-sm md:table-cell",
          },
          cell: ({ row: { original: song } }) => <>{song.order}</>,
          sortFn: "basic",
        }),
        column.display({
          id: "actions",
          header: "관리",
          meta: { className: "w-24 text-right" },
          cell: ({ row: { original: song } }) => (
            <>
              {canManage && (
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => onEdit(song)}
                    title="수정"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:bg-destructive/10 h-8 w-8"
                    onClick={() => onDelete(song)}
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
    data: songs,
    getRowId: (row) => String(row.id),
    initialState: { pagination: { pageIndex: 0, pageSize: 15 } },
  });
  return (
    <DataTable.Root table={table} components={dataTableComponents}>
      <div className="space-y-4">
        <DataTable.Table caption="곡 관리 목록">
          <DataTable.Header />
          <DataTable.Body
            emptyState={
              <>
                <FileMusic className="mx-auto mb-2 h-8 w-8 opacity-50" />
                {hasFilter ? "검색 결과가 없습니다." : "등록된 곡이 없습니다."}
              </>
            }
          />
        </DataTable.Table>
        <DataTable.Pagination label="곡 목록 페이지" />
      </div>
    </DataTable.Root>
  );
}
