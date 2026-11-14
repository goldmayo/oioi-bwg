"use client";

import { createContext, useContext, useEffect, useMemo } from "react";
import { DataTable } from "@oioi-bwg/ui/data-table";
import { FileMusic } from "lucide-react";

import type { AdminSongSummary } from "@/entities/song";

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

import "./song-title-transition.css";

interface Props {
  songs: AdminSongSummary[];
  selectedIds: ReadonlySet<string>;
  onSelect: (id: string, selected: boolean) => void;
  canManage: boolean;
  hasFilter: boolean;
  onEdit: (song: AdminSongSummary) => void;
  onDelete: (song: AdminSongSummary) => void;
}
const SelectionContext = createContext<Pick<
  Props,
  "selectedIds" | "onSelect" | "canManage"
> | null>(null);
function SongSelection({ song }: { song: AdminSongSummary }) {
  const selection = useContext(SelectionContext)!;
  return (
    <Checkbox
      aria-label={`${song.title} 선택`}
      checked={selection.selectedIds.has(song.id)}
      disabled={!selection.canManage}
      onCheckedChange={(checked) => selection.onSelect(song.id, checked === true)}
    />
  );
}
const column = createAppColumnHelper<AdminSongSummary>();

export function SongManagerTable({
  songs,
  selectedIds,
  onSelect,
  canManage,
  hasFilter,
  onEdit,
  onDelete,
}: Props) {
  "use no memo";
  // AppTable은 내부 ref로 options를 읽는다. 자동 memo가 권한/DTO 변경 렌더를 건너뛰지 않게 한다.
  const showOrder = useMediaQuery("(min-width: 768px)");
  const showAlbum = useMediaQuery("(min-width: 1024px)");
  const showSlug = useMediaQuery("(min-width: 1280px)");
  useEffect(() => {
    function captureSongTitle(event: PageSwapEvent) {
      const transition = event.viewTransition;
      const destination = event.activation?.entry.url;
      if (!transition || !destination) return;

      const url = new URL(destination);
      if (url.search || !url.pathname.startsWith(`${adminPaths.songList}/`)) return;
      const link = document.querySelector<HTMLAnchorElement>(
        `[data-song-title-link][href="${CSS.escape(url.pathname)}"]`,
      );
      const title = link?.firstElementChild;
      if (!(title instanceof HTMLElement)) return;

      title.style.viewTransitionName = "song-title";
      // A history restore can reuse this document and its table.
      void transition.finished
        .finally(() => title.style.removeProperty("view-transition-name"))
        .catch(() => {});
    }
    window.addEventListener("pageswap", captureSongTitle);
    return () => window.removeEventListener("pageswap", captureSongTitle);
  }, []);
  const columns = useMemo(
    () =>
      column.columns([
        column.display({
          id: "selection",
          header: "선택",
          size: 64,
          enableSorting: false,
          enableResizing: false,
          meta: { align: "center" },
          cell: ({ row: { original: song } }) => <SongSelection song={song} />,
        }),
        column.accessor("title", {
          header: "제목",
          size: 280,
          minSize: 160,
          meta: { className: "font-medium whitespace-normal" },
          cell: ({ row: { original: song } }) => (
            <a
              href={adminLinks.song(song.id)}
              data-song-title-link
              title={song.title}
              className="text-foreground block truncate underline-offset-4 hover:underline"
            >
              <span className="inline-block max-w-full truncate align-bottom">{song.title}</span>
            </a>
          ),
        }),
        column.accessor((row) => row.album.name, {
          id: "album",
          header: "앨범",
          size: 270,
          minSize: 160,
          meta: {
            className: "text-muted-foreground text-sm",
          },
          cell: ({ row: { original: song } }) => (
            <span className="block truncate" title={song.album.name}>
              {song.album.name}
            </span>
          ),
        }),
        column.accessor("slug", {
          header: "Slug",
          size: 160,
          minSize: 120,
          meta: {
            className: "text-muted-foreground text-xs",
          },
          cell: ({ row: { original: song } }) => (
            <span className="block truncate" title={song.slug ?? undefined}>
              {song.slug ?? "미지정"}
            </span>
          ),
        }),
        column.display({
          id: "type",
          header: "구분",
          size: 96,
          minSize: 80,
          meta: { align: "center" },
          cell: ({ row: { original: song } }) => (
            <>
              <div className="flex flex-wrap justify-center gap-1">
                {song.isTitle && (
                  <Badge variant="rockation" className="px-1.5 py-0.5 text-xs">
                    타이틀
                  </Badge>
                )}
                {song.hasOfficialCheer && (
                  <Badge variant="q" className="px-1.5 py-0.5 text-xs">
                    응원법
                  </Badge>
                )}
              </div>
            </>
          ),
        }),
        column.accessor("isVisible", {
          header: "표시",
          size: 80,
          minSize: 80,
          meta: { align: "center" },
          cell: ({ row }) => <VisibilityIcon visible={row.original.isVisible} />,
          enableSorting: false,
        }),
        column.accessor("order", {
          header: "순서",
          size: 112,
          minSize: 112,
          meta: {
            align: "center",
            className: "text-muted-foreground text-sm",
          },
          cell: ({ row: { original: song } }) => <>{song.order}</>,
          sortFn: "basic",
        }),
        column.display({
          id: "actions",
          enableResizing: false,
          header: () => <TableActionsHeader />,
          size: 72,
          minSize: 72,
          meta: { align: "end", label: "관리", className: "pr-5!" },
          cell: ({ row: { original: song } }) =>
            canManage && (
              <TableRowActions label={song.title}>
                <TableEditAction onClick={() => onEdit(song)} />
                <TableDeleteAction onClick={() => onDelete(song)} />
              </TableRowActions>
            ),
        }),
      ]),
    [canManage, onEdit, onDelete],
  );
  const table = useAppTable({
    columns,
    data: songs,
    state: { columnVisibility: { order: showOrder, album: showAlbum, slug: showSlug } },
    getRowId: (row) => String(row.id),
    initialState: { pagination: { pageIndex: 0, pageSize: 10 } },
  });
  return (
    <SelectionContext value={{ selectedIds, onSelect, canManage }}>
      <DataTable.Root table={table} components={dataTableComponents}>
        <div className="min-w-0 space-y-4">
          <AppDataTable caption="곡 관리 목록">
            <DataTable.Header />
            <DataTable.Body
              padToPageSize
              emptyState={
                <>
                  <FileMusic className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  {hasFilter ? "검색 결과가 없습니다." : "등록된 곡이 없습니다."}
                </>
              }
            />
          </AppDataTable>
          <DataTable.Pagination label="곡 목록 페이지" pageSizes={[10, 20, 50]} />
        </div>
      </DataTable.Root>
    </SelectionContext>
  );
}
