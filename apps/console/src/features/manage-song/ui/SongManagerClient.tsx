"use client";

import { type ReactNode, useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { albumQueries } from "@/entities/album/api";
import type { AdminSongSummary } from "@/entities/song";
import { songQueryKeys } from "@/entities/song";
import { songMutations, songQueries } from "@/entities/song/api";

import { adminLinks, adminPaths } from "@/shared/config/admin-routes";
import { Button } from "@/shared/ui/button";
import { ListHeader, ListSelection, ListToolbar } from "@/shared/ui/list-layout";

import { createWaveformDownload } from "../model/waveform-manifest";

import { SongDeleteDialog } from "./SongDeleteDialog";
import { SongManagerTable } from "./SongManagerTable";
import { SongManagerToolbar } from "./SongManagerToolbar";

interface SongManagerClientProps {
  canManage: boolean;
  submissionNotice?: ReactNode;
  onMutationError?: (error: unknown) => void;
}

export function SongManagerClient({
  canManage,
  submissionNotice,
  onMutationError,
}: SongManagerClientProps) {
  const queryClient = useQueryClient();
  const {
    data: { items: songs },
  } = useSuspenseQuery(songQueries.adminList());
  const {
    data: { items: albums },
  } = useSuspenseQuery(albumQueries.adminList());
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(new Set());
  const [downloadError, setDownloadError] = useState("");
  const selectedSongs = songs.filter((song) => selectedIds.has(song.id));
  const onSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
    setDownloadError("");
  }, []);
  function downloadManifest() {
    if (!canManage) return;
    try {
      const file = createWaveformDownload(selectedSongs);
      const url = URL.createObjectURL(new Blob([file.content], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = file.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloadError("");
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : "작업 파일을 만들지 못했습니다.");
    }
  }
  const [search, setSearch] = useState("");
  const [albumFilter, setAlbumFilter] = useState("all");
  const [deleteTarget, setDeleteTarget] = useState<AdminSongSummary | null>(null);
  const deletingId = useRef<string | null>(null);
  const changeDeleteTarget = useCallback((target: AdminSongSummary | null) => {
    if (deletingId.current === null) setDeleteTarget(target);
  }, []);
  const deleteMutation = useMutation({ ...songMutations.delete(), onError: onMutationError });
  const filtered = useMemo(() => {
    const query = search.toLowerCase();
    return songs.filter(
      (song) =>
        (albumFilter === "all" || song.albumId === albumFilter) &&
        (!query ||
          [song.title, song.slug ?? "", song.album.name].some((value) =>
            value.toLowerCase().includes(query),
          )),
    );
  }, [albumFilter, search, songs]);
  const invalidateSongs = useCallback(
    () => queryClient.invalidateQueries({ queryKey: songQueryKeys.adminList() }),
    [queryClient],
  );
  const handleEdit = useCallback((song: AdminSongSummary) => {
    window.location.assign(adminLinks.songEdit(song.id));
  }, []);
  const handleDelete = useCallback(() => {
    if (!canManage || !deleteTarget || deletingId.current !== null) return;
    deletingId.current = deleteTarget.id;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (_data, id) => {
        setDeleteTarget((current) => (current?.id === id ? null : current));
        void invalidateSongs();
      },
      onSettled: () => {
        deletingId.current = null;
      },
    });
  }, [canManage, deleteMutation, deleteTarget, invalidateSongs]);
  return (
    <div className="space-y-3 md:space-y-4">
      <ListHeader
        title="곡 관리"
        compactOnMobile
        description="곡을 추가, 수정, 삭제할 수 있습니다. 곡 추가 시 LRC 파일이 필요합니다."
        action={
          canManage && (
            <Button variant="q" className="h-11 md:h-9" asChild>
              <a href={adminPaths.songCreate}>곡 추가</a>
            </Button>
          )
        }
      />
      <ListToolbar
        stackActionsOnMobile
        selection={
          <ListSelection
            count={selectedSongs.length}
            onClear={() => {
              setSelectedIds(new Set());
              setDownloadError("");
            }}
          />
        }
        actions={
          selectedSongs.length > 0 && (
            <Button variant="outline" disabled={!canManage} onClick={downloadManifest}>
              waveform 작업 파일 다운로드 ({selectedSongs.length})
            </Button>
          )
        }
      >
        <SongManagerToolbar
          search={search}
          albumFilter={albumFilter}
          albums={albums}
          onSearchChange={setSearch}
          onAlbumChange={setAlbumFilter}
        />
      </ListToolbar>
      {downloadError && (
        <p role="alert" className="text-destructive text-sm">
          {downloadError}
        </p>
      )}
      <SongManagerTable
        songs={filtered}
        selectedIds={selectedIds}
        onSelect={onSelect}
        canManage={canManage}
        hasFilter={!!search || albumFilter !== "all"}
        onEdit={handleEdit}
        onDelete={changeDeleteTarget}
      />
      {submissionNotice}
      {canManage && (
        <SongDeleteDialog
          song={deleteTarget}
          pending={deleteMutation.isPending}
          onClose={() => changeDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
