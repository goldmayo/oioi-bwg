"use client";

import { useCallback, useMemo, useState } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { Edit, FileMusic, Plus, Trash2 } from "lucide-react";
import Link from "next/link";

import { albumQueries } from "@/entities/album";
import type { AdminSongSummary } from "@/entities/song";
import { songMutations, songQueries, songQueryKeys } from "@/entities/song";

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

import type { SongEditValues } from "../model/schemas";

import { SongFormDialog } from "./SongFormDialog";

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
  const [albumFilter, setAlbumFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  // 폼 다이얼로그
  const [formOpen, setFormOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<AdminSongSummary | undefined>();

  // 삭제 확인 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<AdminSongSummary | null>(null);

  const createMutation = useMutation({
    ...songMutations.create(),
    onError: onMutationError,
  });
  const updateMutation = useMutation({
    ...songMutations.update(),
    onError: onMutationError,
  });
  const deleteMutation = useMutation({
    ...songMutations.delete(),
    onError: onMutationError,
  });

  // 필터링
  const filtered = useMemo(() => {
    let result: AdminSongSummary[] = songs;

    // 앨범 필터
    if (albumFilter !== "all") {
      result = result.filter((s) => s.albumId === Number(albumFilter));
    }

    // 검색 필터
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.slug.toLowerCase().includes(q) ||
          s.album.name.toLowerCase().includes(q),
      );
    }

    return result;
  }, [songs, search, albumFilter]);

  // 페이지네이션
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const paged = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [currentPage, filtered],
  );

  const handleAdd = useCallback(() => {
    setEditingSong(undefined);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((song: AdminSongSummary) => {
    setEditingSong(song);
    setFormOpen(true);
  }, []);

  const invalidateSongs = useCallback(
    () => queryClient.invalidateQueries({ queryKey: songQueryKeys.adminList.queryKey }),
    [queryClient],
  );

  const handleSubmit = useCallback(
    async (values: SongEditValues) => {
      if (editingSong) {
        await updateMutation.mutateAsync({ id: editingSong.id, input: values });
      } else {
        await createMutation.mutateAsync({ ...values, lrcText: values.lrcText ?? "" });
      }
      await invalidateSongs();
    },
    [createMutation, editingSong, invalidateSongs, updateMutation],
  );

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      setDeleteTarget(null);
      await invalidateSongs();
    } catch (error) {
      alert(error instanceof Error ? error.message : "곡 삭제에 실패했습니다.");
    }
  }, [deleteMutation, deleteTarget, invalidateSongs]);

  return (
    <div className="space-y-4">
      {/* 상단 액션 바 */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row">
          <Input
            placeholder="곡 제목, slug, 앨범명으로 검색..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            className="sm:max-w-xs"
          />
          <Select
            value={albumFilter}
            onValueChange={(v) => {
              setAlbumFilter(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="전체 앨범" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">전체 앨범</SelectItem>
              {albums.map((album) => (
                <SelectItem key={album.id} value={String(album.id)}>
                  {album.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {canManage && (
          <Button onClick={handleAdd} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />곡 추가
          </Button>
        )}
      </div>

      {/* 테이블 */}
      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-12">ID</TableHead>
              <TableHead>제목</TableHead>
              <TableHead className="hidden sm:table-cell">앨범</TableHead>
              <TableHead className="hidden lg:table-cell">Slug</TableHead>
              <TableHead className="w-20 text-center">구분</TableHead>
              <TableHead className="hidden w-16 text-center md:table-cell">순서</TableHead>
              <TableHead className="w-24 text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                  <FileMusic className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  {search || albumFilter !== "all"
                    ? "검색 결과가 없습니다."
                    : "등록된 곡이 없습니다."}
                </TableCell>
              </TableRow>
            ) : (
              paged.map((song) => (
                <TableRow key={song.id} className="hover:bg-accent/30 transition-colors">
                  <TableCell className="text-muted-foreground text-xs">{song.id}</TableCell>
                  <TableCell className="font-medium">
                    <Link
                      href={`/admin/edit/${song.slug}`}
                      className="text-primary hover:underline"
                      prefetch={false}
                    >
                      {song.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm sm:table-cell">
                    {song.album.name}
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                    {song.slug}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex flex-wrap justify-center gap-1">
                      {song.isTitle && (
                        <Badge variant="default" className="text-2xs px-1.5 py-0">
                          타이틀
                        </Badge>
                      )}
                      {song.hasOfficialCheer && (
                        <Badge variant="secondary" className="text-2xs px-1.5 py-0">
                          응원법
                        </Badge>
                      )}
                      {!song.isVisible && (
                        <Badge
                          variant="outline"
                          className="text-2xs text-muted-foreground px-1.5 py-0"
                        >
                          숨김
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-center text-sm md:table-cell">
                    {song.order}
                  </TableCell>
                  <TableCell className="text-right">
                    {canManage && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(song)}
                          title="수정"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:bg-destructive/10 h-8 w-8"
                          onClick={() => setDeleteTarget(song)}
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
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm">
          총 {filtered.length}곡 {(search || albumFilter !== "all") && `(전체 ${songs.length}곡)`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
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
      </div>

      {/* 곡 폼 다이얼로그 */}
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

      {/* 삭제 확인 다이얼로그 */}
      {canManage && (
        <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>곡 삭제</DialogTitle>
              <DialogDescription>
                <strong>&ldquo;{deleteTarget?.title}&rdquo;</strong> 곡을 삭제하시겠습니까?
                <br />이 작업은 되돌릴 수 없습니다.
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
