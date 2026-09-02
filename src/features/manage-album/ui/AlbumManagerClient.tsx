"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Edit, Plus, Trash2 } from "lucide-react";

import type { AdminAlbumSummary } from "@/entities/album";
import { albumMutations, albumQueries, albumQueryKeys } from "@/entities/album";

import { Badge } from "@/shared/ui/badge";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import type { AlbumFormValues } from "../model/schemas";

import { AlbumFormDialog } from "./AlbumFormDialog";

const PAGE_SIZE = 10;

interface AlbumManagerClientProps {
  canManage: boolean;
  onMutationError?: (error: unknown) => void;
}

export function AlbumManagerClient({ canManage, onMutationError }: AlbumManagerClientProps) {
  const queryClient = useQueryClient();
  const { data: albums } = useSuspenseQuery(albumQueries.adminList());
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

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

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [currentPage, filtered],
  );

  const handleAdd = useCallback(() => {
    setEditingAlbum(undefined);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((album: AdminAlbumSummary) => {
    setEditingAlbum(album);
    setFormOpen(true);
  }, []);

  const invalidateAlbums = useCallback(
    () => queryClient.invalidateQueries({ queryKey: albumQueryKeys.adminList.queryKey }),
    [queryClient],
  );

  const handleSubmit = useCallback(
    async (values: AlbumFormValues) => {
      const input = { ...values, releaseDate: values.releaseDate || null };

      if (editingAlbum) {
        await updateMutation.mutateAsync({ id: editingAlbum.id, input });
      } else {
        await createMutation.mutateAsync(input);
      }
      await invalidateAlbums();
    },
    [createMutation, editingAlbum, invalidateAlbums, updateMutation],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      await invalidateAlbums();
    } catch (error) {
      alert(error instanceof Error ? error.message : "앨범 삭제에 실패했습니다.");
    }
  }, [deleteMutation, deleteTarget, invalidateAlbums]);

  return (
    <div className="space-y-4">
      {/* 상단 액션 바 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="앨범 이름 또는 slug로 검색..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
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

      {/* 테이블 */}
      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">ID</TableHead>
              <TableHead>이름</TableHead>
              <TableHead className="hidden sm:table-cell">Slug</TableHead>
              <TableHead className="w-16">색상</TableHead>
              <TableHead className="w-16 text-center">표시</TableHead>
              <TableHead className="hidden md:table-cell">발매일</TableHead>
              <TableHead className="w-24 text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  {search ? "검색 결과가 없습니다." : "등록된 앨범이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((album) => (
                <TableRow key={album.id} className="hover:bg-accent/30 transition-colors">
                  <TableCell className="text-muted-foreground text-xs">{album.id}</TableCell>
                  <TableCell className="font-medium">{album.name}</TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                    {album.slug}
                  </TableCell>
                  <TableCell>
                    <div
                      className="h-6 w-6 rounded-full border"
                      style={{ backgroundColor: album.color }}
                      title={album.color}
                    />
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge
                      variant={album.isVisible ? "default" : "outline"}
                      className="text-2xs px-1.5 py-0"
                    >
                      {album.isVisible ? "표시" : "숨김"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                    {album.releaseDate
                      ? new Date(album.releaseDate).toLocaleDateString("ko-KR")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(album)}
                          title="수정"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 h-8 w-8"
                          onClick={() => setDeleteTarget(album)}
                          title="삭제"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </Button>
          <span className="text-muted-foreground text-sm">
            {currentPage + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      )}

      {/* 앨범 폼 다이얼로그 */}
      {canManage && (
        <AlbumFormDialog
          key={editingAlbum?.id ?? "new"}
          open={formOpen}
          onOpenChange={setFormOpen}
          album={editingAlbum}
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
