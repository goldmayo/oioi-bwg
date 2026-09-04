"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";

import { albumQueries } from "@/entities/album";
import type { AdminSongSummary } from "@/entities/song";
import { songMutations, songQueries, songQueryKeys } from "@/entities/song";

import type { SongEditValues } from "../model/schemas";

import { SongDeleteDialog } from "./SongDeleteDialog";
import { SongFormDialog } from "./SongFormDialog";
import { SongManagerTable } from "./SongManagerTable";
import { SongManagerToolbar } from "./SongManagerToolbar";

const PAGE_SIZE = 15;
interface SongManagerClientProps {
  canManage: boolean;
  onMutationError?: (error: unknown) => void;
}

export function SongManagerClient({ canManage, onMutationError }: SongManagerClientProps) {
  const queryClient = useQueryClient();
  const { data: songs } = useSuspenseQuery(songQueries.adminList());
  const { data: albums } = useSuspenseQuery(albumQueries.adminList());
  const [search, setSearch] = useState("");
  const [albumFilter, setAlbumFilter] = useState("all");
  const [page, setPage] = useState(0);
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
        (albumFilter === "all" || song.albumId === Number(albumFilter)) &&
        (!query ||
          [song.title, song.slug, song.album.name].some((value) =>
            value.toLowerCase().includes(query),
          )),
    );
  }, [albumFilter, search, songs]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [currentPage, filtered],
  );
  const invalidateSongs = useCallback(
    () => queryClient.invalidateQueries({ queryKey: songQueryKeys.adminList() }),
    [queryClient],
  );
  const handleSubmit = useCallback(
    async (values: SongEditValues) => {
      if (editingSong) await updateMutation.mutateAsync({ id: editingSong.id, input: values });
      else await createMutation.mutateAsync({ ...values, lrcText: values.lrcText ?? "" });
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
          setPage(0);
        }}
        onAlbumChange={(value) => {
          setAlbumFilter(value);
          setPage(0);
        }}
        onAdd={() => {
          setEditingSong(undefined);
          setFormOpen(true);
        }}
      />
      <SongManagerTable
        songs={paged}
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
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="border-input rounded-md border px-3 py-1 text-sm"
              disabled={currentPage === 0}
              onClick={() => setPage((value) => value - 1)}
            >
              이전
            </button>
            <span className="text-muted-foreground text-sm">
              {currentPage + 1} / {totalPages}
            </span>
            <button
              type="button"
              className="border-input rounded-md border px-3 py-1 text-sm"
              disabled={currentPage >= totalPages - 1}
              onClick={() => setPage((value) => value + 1)}
            >
              다음
            </button>
          </div>
        )}
      </div>
      {canManage && (
        <SongFormDialog
          key={editingSong?.id ?? "new"}
          open={formOpen}
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
