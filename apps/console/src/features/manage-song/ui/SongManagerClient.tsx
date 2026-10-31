"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { albumQueries } from "@/entities/album/api";
import type { AdminSongSummary } from "@/entities/song";
import { songQueryKeys } from "@/entities/song";
import { songMutations, songQueries } from "@/entities/song/api";

import { Button } from "@/shared/ui/button";

import { type SongEditValues, toAdminSongUpdate } from "../model/schemas";
import { createWaveformDownload } from "../model/waveform-manifest";

import { SongDeleteDialog } from "./SongDeleteDialog";
import { SongFormDialog } from "./SongFormDialog";
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
  const [formOpen, setFormOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<AdminSongSummary>();
  const [deleteTarget, setDeleteTarget] = useState<AdminSongSummary | null>(null);
  const createMutation = useMutation({ ...songMutations.create(), onError: onMutationError });
  const updateMutation = useMutation({ ...songMutations.update(), onError: onMutationError });
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
  const handleSubmit = useCallback(
    async (values: SongEditValues) => {
      if (editingSong) {
        await updateMutation.mutateAsync({
          id: editingSong.id,
          input: { ...toAdminSongUpdate(values), guideWrite: editingSong.guideWrite },
        });
      } else await createMutation.mutateAsync({ ...values, lrcText: values.lrcText ?? "" });
      await invalidateSongs();
    },
    [createMutation, editingSong, invalidateSongs, updateMutation],
  );
  const handleEdit = useCallback((song: AdminSongSummary) => {
    setEditingSong(song);
    setFormOpen(true);
  }, []);
  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        void invalidateSongs();
      },
    });
  }, [deleteMutation, deleteTarget, invalidateSongs]);
  return (
    <div className="space-y-4">
      <SongManagerToolbar
        search={search}
        albumFilter={albumFilter}
        albums={albums}
        canManage={canManage}
        onSearchChange={(value) => {
          setSearch(value);
        }}
        onAlbumChange={(value) => {
          setAlbumFilter(value);
        }}
        onAdd={() => {
          setEditingSong(undefined);
          setFormOpen(true);
        }}
      />
      <div className="flex flex-wrap items-center gap-3">
        <Button
          variant="outline"
          disabled={!canManage || !selectedSongs.length}
          onClick={downloadManifest}
        >
          파형 작업 파일 다운로드 ({selectedSongs.length}곡)
        </Button>
        {selectedSongs.length > 0 && (
          <Button
            variant="ghost"
            onClick={() => {
              setSelectedIds(new Set());
              setDownloadError("");
            }}
          >
            선택 해제
          </Button>
        )}
        <p className="text-muted-foreground text-sm">
          검색·페이지를 바꿔도 선택한 곡은 유지됩니다.
        </p>
      </div>
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
        onDelete={setDeleteTarget}
      />
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          총 {filtered.length}곡 {(search || albumFilter !== "all") && `(전체 ${songs.length}곡)`}
        </span>
      </div>
      {formOpen && (
        <SongFormDialog
          key={editingSong?.id ?? "new"}
          open={formOpen}
          canSubmit={canManage}
          submissionNotice={submissionNotice}
          onOpenChange={setFormOpen}
          albums={albums}
          song={editingSong}
          onSubmit={handleSubmit}
        />
      )}
      {canManage && (
        <SongDeleteDialog
          song={deleteTarget}
          pending={deleteMutation.isPending}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
