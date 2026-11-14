"use client";
import { useMemo } from "react";
import { DataTable } from "@oioi-bwg/ui/data-table";
import type { OnChangeFn, RowSelectionState } from "@tanstack/react-table";

import type { AdminCheerGuideSummary } from "@/entities/cheer-guide";

import { adminLinks, adminPaths } from "@/shared/config/admin-routes";
import { useMediaQuery } from "@/shared/model/useMediaQuery";
import { Badge } from "@/shared/ui/badge";
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

const column = createAppColumnHelper<AdminCheerGuideSummary>();

function guideEditorHref(guide: AdminCheerGuideSummary) {
  if (guide.draftEditorAvailable) return adminLinks.guideEdit(guide.id, adminPaths.guideList);
  if (guide.editorAvailable && guide.song.slug)
    return adminLinks.songLyrics(guide.song.slug, guide.id);
}

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
          cell: ({ row: { original: guide } }) => {
            const { song } = guide;
            const href = canManage ? guideEditorHref(guide) : undefined;
            return (
              <div className="min-w-0">
                {href ? (
                  <a
                    href={href}
                    title={song.title}
                    className="text-foreground focus-visible:ring-ring block truncate rounded-sm font-medium underline-offset-4 hover:underline focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {song.title || "제목 없음"}
                  </a>
                ) : (
                  <span title={song.title} className="text-foreground block truncate font-medium">
                    {song.title || "제목 없음"}
                  </span>
                )}
                <span
                  className="text-muted-foreground block truncate text-xs"
                  title={song.albumName}
                >
                  {song.albumName}
                </span>
              </div>
            );
          },
        }),
        column.accessor("mode", {
          header: "모드",
          meta: { align: "center" },
          size: 120,
          minSize: 96,
          cell: ({ row: { original } }) => (
            <Badge
              variant={original.mode === "CONCERT" ? "r" : "e"}
              className="md:border-transparent md:bg-transparent"
            >
              {original.mode === "CONCERT" ? "단콘" : "페벌"}
            </Badge>
          ),
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
              <Badge
                variant={publication.sourceType === "OFFICIAL" ? "q" : "w"}
                className="md:border-transparent md:bg-transparent"
              >
                {publication.sourceType === "OFFICIAL" ? "공식" : "팬덤"}
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
              <VisibilityIcon visible={publication.action === "PUBLISH"} />
            ) : (
              <span className="text-muted-foreground">이력 없음</span>
            ),
        }),
        column.display({
          id: "actions",
          enableResizing: false,
          header: () => <TableActionsHeader />,
          meta: { align: "end", label: "관리", className: "pr-5!" },
          size: 72,
          minSize: 72,
          cell: ({ row: { original: guide } }) => {
            const editorHref = guideEditorHref(guide);
            return (
              canManage && (
                <TableRowActions
                  label={`${guide.song.title} ${guide.mode === "CONCERT" ? "콘서트" : "페스티벌"} 응원법`}
                >
                  {editorHref && <TableEditAction href={editorHref} />}
                  <TableDeleteAction
                    disabled={!guide.deletable}
                    title={
                      guide.deletable
                        ? "응원법 삭제"
                        : "내용 또는 공개 이력이 있는 응원법은 삭제할 수 없습니다."
                    }
                    onClick={() => onDelete(guide)}
                  />
                </TableRowActions>
              )
            );
          },
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
            padToPageSize
            emptyState={hasFilter ? "검색 결과가 없습니다." : "등록된 응원법이 없습니다."}
          />
        </AppDataTable>
        <DataTable.Pagination label="응원법 목록 페이지" pageSizes={[10, 20, 50]} />
      </div>
    </DataTable.Root>
  );
}
