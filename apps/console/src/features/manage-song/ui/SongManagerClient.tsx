"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { albumQueries } from "@/entities/album/api";
import type { AdminSongSummary } from "@/entities/song";
import { songQueryKeys } from "@/entities/song";
import { songMutations, songQueries } from "@/entities/song/api";

import { type SongEditValues, toAdminSongUpdate } from "../model/schemas";

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
        await updateMutation.mutateAsync({ id: editingSong.id, input: toAdminSongUpdate(values) });
      } else await createMutation.mutateAsync({ ...values, lrcText: values.lrcText ?? "" });
      await invalidateSongs();
    },
    [createMutation, editingSong, invalidateSongs, updateMutation],
  );
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
      <SongManagerTable
        songs={filtered}
        canManage={canManage}
        hasFilter={!!search || albumFilter !== "all"}
        onEdit={(song) => {
          setEditingSong(song);
          setFormOpen(true);
        }}
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
