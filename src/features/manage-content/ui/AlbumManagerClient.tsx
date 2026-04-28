"use client";

import { Edit, Plus, Trash2 } from "lucide-react";
import { useCallback, useMemo, useState } from "react";

import { Album } from "@/shared/api/db/drizzle/schema";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

import { deleteAlbumAction } from "../actions";
import { AlbumFormDialog } from "./AlbumFormDialog";

const PAGE_SIZE = 10;

interface AlbumManagerClientProps {
  initialAlbums: Album[];
}

export function AlbumManagerClient({ initialAlbums }: AlbumManagerClientProps) {
  const [albums, setAlbums] = useState(initialAlbums);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  // 폼 다이얼로그
  const [formOpen, setFormOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<Album | undefined>();

  // 삭제 확인 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<Album | null>(null);

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
  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  // 페이지 범위 초과 방지
  if (page >= totalPages && page > 0) setPage(totalPages - 1);

  const handleAdd = useCallback(() => {
    setEditingAlbum(undefined);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((album: Album) => {
    setEditingAlbum(album);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const result = await deleteAlbumAction(deleteTarget.id);
    if (result.success) {
      setAlbums((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      alert(result.error);
    }
  }, [deleteTarget]);

  const handleSuccess = useCallback(() => {
    // Server Action 후 router refresh로 최신 데이터 반영
    window.location.reload();
  }, []);

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
        <Button onClick={handleAdd} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          앨범 추가
        </Button>
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
              <TableHead className="hidden md:table-cell">발매일</TableHead>
              <TableHead className="w-24 text-right">관리</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paged.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-muted-foreground py-8 text-center">
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
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                    {album.releaseDate
                      ? new Date(album.releaseDate).toLocaleDateString("ko-KR")
                      : "-"}
                  </TableCell>
                  <TableCell className="text-right">
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
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            이전
          </Button>
          <span className="text-muted-foreground text-sm">
            {page + 1} / {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages - 1}
            onClick={() => setPage((p) => p + 1)}
          >
            다음
          </Button>
        </div>
      )}

      {/* 앨범 폼 다이얼로그 */}
      <AlbumFormDialog
        key={editingAlbum?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        album={editingAlbum}
        onSuccess={handleSuccess}
      />

      {/* 삭제 확인 다이얼로그 */}
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
            <Button variant="destructive" onClick={handleDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
