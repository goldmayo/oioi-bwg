"use client";

import { useMemo } from "react";
import { DataTable } from "@oioi-bwg/ui/data-table";
import { Eye, EyeOff, Info, Pencil } from "lucide-react";
import Link from "next/link";

import type { AdminCheerGuideSummary } from "@/entities/cheer-guide";

import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { createAppColumnHelper, dataTableComponents, useAppTable } from "@/shared/ui/data-table";

const column = createAppColumnHelper<AdminCheerGuideSummary>();
export function GuideTable({
  guides,
  canManage,
  hasFilter,
}: {
  guides: AdminCheerGuideSummary[];
  canManage: boolean;
  hasFilter: boolean;
}) {
  "use no memo";
  const wide = useMediaQuery("(min-width: 768px)");
  const columns = useMemo(
    () =>
      column.columns([
        column.accessor((guide) => guide.song.title, {
          id: "song",
          header: "곡",
          size: wide ? 310 : 210,
          minSize: 180,
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
          size: 120,
          minSize: 96,
          cell: ({ row: { original } }) => (original.mode === "CONCERT" ? "콘서트" : "페스티벌"),
        }),
        column.accessor((guide) => guide.currentPublication?.sourceType ?? "", {
          id: "source",
          header: "출처",
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
          size: 150,
          minSize: 125,
          cell: ({
            row: {
              original: { currentPublication: publication },
            },
          }) =>
            publication ? (
              <span className="flex items-center gap-2">
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
          header: "관리",
          size: 100,
          minSize: 100,
          cell: ({ row: { original: guide } }) => (
            <div className="flex gap-1">
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
            </div>
          ),
        }),
      ]),
    [canManage, wide],
  );
  const table = useAppTable({
    columns,
    data: guides,
    getRowId: (guide) => guide.id,
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <DataTable.Root table={table} components={dataTableComponents}>
      <div className="min-w-0 space-y-4">
        <DataTable.Table
          caption="응원법 관리 목록"
          fillWidth
          className="bg-card table-fixed [&_td]:px-3 [&_td]:py-3 [&_th]:px-3"
        >
          <DataTable.Header />
          <DataTable.Body
            emptyState={hasFilter ? "검색 결과가 없습니다." : "등록된 응원법이 없습니다."}
          />
        </DataTable.Table>
        <DataTable.Pagination label="응원법 목록 페이지" pageSizes={[10, 20, 50]} />
      </div>
    </DataTable.Root>
  );
}
