"use client";

import { type ReactNode, useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";

import type { AdminAlbumSummary } from "@/entities/album";
import { albumQueryKeys } from "@/entities/album";
import { albumMutations, albumQueries } from "@/entities/album/api";

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

import type { AlbumFormValues } from "../model/schemas";

import { AlbumFormDialog, type UploadAlbumImage } from "./AlbumFormDialog";
import { AlbumManagerTable } from "./AlbumManagerTable";

interface AlbumManagerClientProps {
  canManage: boolean;
  submissionNotice?: ReactNode;
  onUploadImage: UploadAlbumImage;
  onMutationError?: (error: unknown) => void;
  onNameChangeOrDelete?: () => void;
}

export function AlbumManagerClient({
  canManage,
  submissionNotice,
  onUploadImage,
  onMutationError,
  onNameChangeOrDelete,
}: AlbumManagerClientProps) {
  const queryClient = useQueryClient();
  const {
    data: { items: albums },
  } = useSuspenseQuery(albumQueries.adminList());
  const [search, setSearch] = useState("");

  // 폼 다이얼로그
  const [formOpen, setFormOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<AdminAlbumSummary | undefined>();

  // 삭제 확인 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<AdminAlbumSummary | null>(null);

  const createMutation = useMutation({
    ...albumMutations.create(),
    onError: onMutationError,
  });
  const updateMutation = useMutation({
    ...albumMutations.update(),
    onError: onMutationError,
  });
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

  const handleAdd = useCallback(() => {
    setEditingAlbum(undefined);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((album: AdminAlbumSummary) => {
    setEditingAlbum(album);
    setFormOpen(true);
  }, []);

  const invalidateAlbums = useCallback(
    () => queryClient.invalidateQueries({ queryKey: albumQueryKeys.adminList() }),
    [queryClient],
  );

  const handleSubmit = useCallback(
    async (values: AlbumFormValues) => {
      const input = { ...values, releaseDate: values.releaseDate || null };

      if (editingAlbum) {
        const updatedAlbum = await updateMutation.mutateAsync({ id: editingAlbum.id, input });
        if (updatedAlbum.name !== editingAlbum.name) onNameChangeOrDelete?.();
      } else {
        await createMutation.mutateAsync(input);
      }
      await invalidateAlbums();
    },
    [createMutation, editingAlbum, invalidateAlbums, onNameChangeOrDelete, updateMutation],
  );

  const handleDelete = useCallback(() => {
    if (!deleteTarget) return;
    deleteMutation.mutate(deleteTarget.id, {
      onSuccess: () => {
        setDeleteTarget(null);
        onNameChangeOrDelete?.();
        void invalidateAlbums();
      },
    });
  }, [deleteMutation, deleteTarget, invalidateAlbums, onNameChangeOrDelete]);

  return (
    <div className="space-y-4">
      {/* 상단 액션 바 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="앨범 이름 또는 slug로 검색..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
          }}
          className="sm:max-w-xs"
        />
        {canManage && (
          <Button onClick={handleAdd} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />
            앨범 추가
          </Button>
        )}
      </div>

      <AlbumManagerTable
        albums={filtered}
        canManage={canManage}
        hasFilter={!!search}
        onEdit={handleEdit}
        onDelete={setDeleteTarget}
      />

      {/* 앨범 폼 다이얼로그 */}
      {formOpen && (
        <AlbumFormDialog
          key={editingAlbum?.id ?? "new"}
          open={formOpen}
          canSubmit={canManage}
          submissionNotice={submissionNotice}
          onOpenChange={setFormOpen}
          album={editingAlbum}
          onUploadImage={onUploadImage}
          onSubmit={handleSubmit}
        />
      )}

      {/* 삭제 확인 다이얼로그 */}
      {canManage && (
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
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
              <Button variant="outline" onClick={() => setDeleteTarget(null)}>
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
