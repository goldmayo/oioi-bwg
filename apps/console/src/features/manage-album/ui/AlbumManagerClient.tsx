"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import type { RowSelectionState } from "@tanstack/react-table";

import type { AdminAlbumSummary } from "@/entities/album";
import { albumQueryKeys } from "@/entities/album";
import { albumMutations, albumQueries } from "@/entities/album/api";

import { adminLinks, adminPaths } from "@/shared/config/admin-routes";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { ListHeader, ListSelection, ListToolbar } from "@/shared/ui/list-layout";

import { AlbumManagerTable } from "./AlbumManagerTable";

interface AlbumManagerClientProps {
  canManage: boolean;
  onMutationError?: (error: unknown) => void;
  onNameChangeOrDelete?: () => void;
}

export function AlbumManagerClient({
  canManage,
  onMutationError,
  onNameChangeOrDelete,
}: AlbumManagerClientProps) {
  const queryClient = useQueryClient();
  const {
    data: { items: albums },
  } = useSuspenseQuery(albumQueries.adminList());
  const [selection, setSelection] = useState<RowSelectionState>({});
  const selectedCount = albums.filter((album) => selection[album.id]).length;
  const [search, setSearch] = useState("");

  // 삭제 확인 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<AdminAlbumSummary | null>(null);
  const deletingId = useRef<string | null>(null);
  const changeDeleteTarget = useCallback((target: AdminAlbumSummary | null) => {
    if (deletingId.current === null) setDeleteTarget(target);
  }, []);

  const deleteMutation = useMutation({
    ...albumMutations.delete(),
    onError: onMutationError,
  });

  // 검색 필터링
  const filtered = useMemo(() => {
    if (!search) return albums;
    const q = search.toLowerCase();
    return albums.filter(
      (a) => a.name.toLowerCase().includes(q) || a.slug.toLowerCase().includes(q),
    );
  }, [albums, search]);

  const handleEdit = useCallback((album: AdminAlbumSummary) => {
    window.location.assign(adminLinks.albumEdit(album.id));
  }, []);

  const invalidateAlbums = useCallback(
    () => queryClient.invalidateQueries({ queryKey: albumQueryKeys.adminList() }),
    [queryClient],
  );

  const handleDelete = useCallback(() => {
    if (!canManage || !deleteTarget || deletingId.current !== null) return;
    deletingId.current = deleteTarget.id;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: (_data, id) => {
        setDeleteTarget((current) => (current?.id === id ? null : current));
        onNameChangeOrDelete?.();
        void invalidateAlbums();
      },
      onSettled: () => {
        deletingId.current = null;
      },
    });
  }, [canManage, deleteMutation, deleteTarget, invalidateAlbums, onNameChangeOrDelete]);

  return (
    <div className="space-y-4">
      <ListHeader
        title="앨범 관리"
        description="앨범을 추가, 수정, 삭제할 수 있습니다."
        action={
          canManage && (
            <Button variant="q" asChild>
              <a href={adminPaths.albumCreate}>앨범 추가</a>
            </Button>
          )
        }
      />
      <ListToolbar
        selection={<ListSelection count={selectedCount} onClear={() => setSelection({})} />}
      >
        <Input
          aria-label="앨범 검색"
          placeholder="앨범 이름 또는 slug로 검색..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="sm:max-w-xs"
        />
      </ListToolbar>

      <AlbumManagerTable
        albums={filtered}
        selection={selection}
        onSelectionChange={setSelection}
        canManage={canManage}
        hasFilter={!!search}
        onEdit={handleEdit}
        onDelete={changeDeleteTarget}
      />

      {/* 삭제 확인 다이얼로그 */}
      {canManage && (
        <Dialog
          open={!!deleteTarget}
          onOpenChange={(open) => {
            if (!open) changeDeleteTarget(null);
          }}
        >
          <DialogContent showCloseButton={!deleteMutation.isPending}>
            <DialogHeader>
              <DialogTitle>앨범 삭제</DialogTitle>
              <DialogDescription>
                <strong>&ldquo;{deleteTarget?.name}&rdquo;</strong> 앨범을 삭제하시겠습니까?
                <br />
                <span className="text-destructive font-semibold">
                  소속된 모든 곡이 함께 삭제됩니다.
                </span>
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => changeDeleteTarget(null)}
              >
                취소
              </Button>
              <Button
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={handleDelete}
              >
                삭제
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
