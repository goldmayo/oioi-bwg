"use client";

import { useMemo } from "react";
import { DataTable } from "@oioi-bwg/ui/data-table";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";
import { Eye, EyeOff, Info, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import type { AdminCheerGuideSummary } from "@/entities/cheer-guide";

import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import {
  AppDataTable,
  createAppColumnHelper,
  dataTableComponents,
  useAppTable,
} from "@/shared/ui/data-table";

const column = createAppColumnHelper<AdminCheerGuideSummary>();
export function GuideTable({
  guides,
  canManage,
  hasFilter,
  selection,
  onSelectionChange,
  onDelete,
}: {
  guides: AdminCheerGuideSummary[];
  canManage: boolean;
  hasFilter: boolean;
  selection: RowSelectionState;
  onSelectionChange: OnChangeFn<RowSelectionState>;
  onDelete: (guide: AdminCheerGuideSummary) => void;
}) {
  "use no memo";
  const wide = useMediaQuery("(min-width: 768px)");
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
              aria-label={`${row.original.song.title} ${row.original.mode === "CONCERT" ? "콘서트" : "페스티벌"} 응원법 선택`}
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onCheckedChange={(checked) => row.toggleSelected(checked === true)}
            />
          ),
        }),
        column.accessor((guide) => guide.song.title, {
          id: "song",
          header: "곡",
          size: wide ? 310 : 160,
          minSize: 160,
          cell: ({
            row: {
              original: { song },
            },
          }) => (
            <div className="min-w-0">
              <Link
                href={`/admin/songs/${song.id}`}
                className="text-foreground block font-medium break-words hover:underline"
              >
                {song.title || "제목 없음"}
              </Link>
              <span className="text-muted-foreground text-xs">{song.albumName}</span>
            </div>
          ),
        }),
        column.accessor("mode", {
          header: "모드",
          meta: { align: "center" },
          size: 120,
          minSize: 96,
          cell: ({ row: { original } }) => (original.mode === "CONCERT" ? "콘서트" : "페스티벌"),
        }),
        column.accessor((guide) => guide.currentPublication?.sourceType ?? "", {
          id: "source",
          header: "출처",
          meta: { align: "center" },
          size: 140,
          minSize: 112,
          cell: ({
            row: {
              original: { currentPublication: publication },
            },
          }) =>
            publication ? (
              <Badge variant={publication.sourceType === "OFFICIAL" ? "q" : "bwg"}>
                {publication.sourceType === "OFFICIAL" ? "official" : "fan-made"}
              </Badge>
            ) : (
              <span className="text-muted-foreground">-</span>
            ),
        }),
        column.accessor((guide) => guide.currentPublication?.action ?? "", {
          id: "publication",
          header: "공개 조치",
          meta: { align: "center" },
          size: 150,
          minSize: 125,
          cell: ({
            row: {
              original: { currentPublication: publication },
            },
          }) =>
            publication ? (
              <span className="flex items-center justify-center gap-2">
                {publication.action === "PUBLISH" ? (
                  <Eye className="size-4" />
                ) : (
                  <EyeOff className="text-muted-foreground size-4" />
                )}
                {publication.action === "PUBLISH" ? "공개" : "공개 중단"}
              </span>
            ) : (
              <span className="text-muted-foreground">이력 없음</span>
            ),
        }),
        column.display({
          id: "actions",
          enableResizing: false,
          header: "관리",
          meta: { align: "end" },
          size: 136,
          minSize: 128,
          cell: ({ row: { original: guide } }) => (
            <div className="flex justify-end gap-1">
              <Button variant="ghost" size="icon-sm" asChild>
                <Link
                  href={`/admin/songs/${guide.song.id}`}
                  aria-label={`${guide.song.title} 곡 정보`}
                >
                  <Info />
                </Link>
              </Button>
              {canManage && guide.editorAvailable && guide.song.slug && (
                <Button variant="ghost" size="icon-sm" asChild>
                  <Link
                    href={`/admin/edit/${guide.song.slug}?guideId=${guide.id}`}
                    aria-label={`${guide.song.title} ${guide.mode === "CONCERT" ? "콘서트" : "페스티벌"} 응원법 편집`}
                  >
                    <Pencil />
                  </Link>
                </Button>
              )}
              {canManage && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={!guide.deletable}
                  title={
                    guide.deletable
                      ? "응원법 삭제"
                      : "내용 또는 공개 이력이 있는 응원법은 삭제할 수 없습니다."
                  }
                  aria-label={`${guide.song.title} ${guide.mode === "CONCERT" ? "콘서트" : "페스티벌"} 응원법 삭제`}
                  onClick={() => onDelete(guide)}
                >
                  <Trash2 className="text-destructive" />
                </Button>
              )}
            </div>
          ),
        }),
      ]),
    [canManage, wide, onDelete],
  );
  const table = useAppTable({
    columns,
    data: guides,
    state: { rowSelection: selection },
    onRowSelectionChange: onSelectionChange,
    enableRowSelection: canManage,
    getRowId: (guide) => guide.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <DataTable.Root table={table} components={dataTableComponents}>
      <div className="min-w-0 space-y-4">
        <AppDataTable caption="응원법 관리 목록">
          <DataTable.Header />
          <DataTable.Body
            emptyState={hasFilter ? "검색 결과가 없습니다." : "등록된 응원법이 없습니다."}
          />
        </AppDataTable>
        <DataTable.Pagination label="응원법 목록 페이지" pageSizes={[10, 20, 50]} />
      </div>
    </DataTable.Root>
  );
}
