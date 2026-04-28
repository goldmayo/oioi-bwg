"use client";

import { Edit, FileMusic, Plus, Trash2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import { Album } from "@/shared/api/db/drizzle/schema";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/ui/table";

import { deleteSongAction } from "../actions";
import { SongFormDialog } from "./SongFormDialog";

const PAGE_SIZE = 15;

/** getSongsWithAlbum 쿼리 결과 타입 */
interface SongWithAlbum {
  id: number;
  title: string;
  slug: string;
  albumId: number;
  order: number;
  youtubeId: string;
  updatedAt: string;
  hasOfficialCheer: boolean;
  isTitle: boolean;
  isVisible: boolean;
  album: { name: string };
}

interface SongManagerClientProps {
  initialSongs: SongWithAlbum[];
  albums: Album[];
}

export function SongManagerClient({ initialSongs, albums }: SongManagerClientProps) {
  const [songs, setSongs] = useState(initialSongs);
  const [search, setSearch] = useState("");
  const [albumFilter, setAlbumFilter] = useState<string>("all");
  const [page, setPage] = useState(0);

  // 폼 다이얼로그
  const [formOpen, setFormOpen] = useState(false);
  const [editingSong, setEditingSong] = useState<SongWithAlbum | undefined>();

  // 삭제 확인 다이얼로그
  const [deleteTarget, setDeleteTarget] = useState<SongWithAlbum | null>(null);

  // 필터링
  const filtered = useMemo(() => {
    let result = songs;

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
  const paged = useMemo(
    () => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE),
    [filtered, page],
  );

  if (page >= totalPages && page > 0) setPage(totalPages - 1);

  const handleAdd = useCallback(() => {
    setEditingSong(undefined);
    setFormOpen(true);
  }, []);

  const handleEdit = useCallback((song: SongWithAlbum) => {
    setEditingSong(song);
    setFormOpen(true);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;
    const result = await deleteSongAction(deleteTarget.id);
    if (result.success) {
      setSongs((prev) => prev.filter((s) => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } else {
      alert(result.error);
    }
  }, [deleteTarget]);

  const handleSuccess = useCallback(() => {
    window.location.reload();
  }, []);

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
        <Button onClick={handleAdd} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          곡 추가
        </Button>
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
              <TableHead className="hidden md:table-cell w-16 text-center">순서</TableHead>
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
                        <Badge variant="outline" className="text-2xs px-1.5 py-0 text-muted-foreground">
                          숨김
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-center text-sm md:table-cell">
                    {song.order}
                  </TableCell>
                  <TableCell className="text-right">
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
          총 {filtered.length}곡{" "}
          {(search || albumFilter !== "all") && `(전체 ${songs.length}곡)`}
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
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
      </div>

      {/* 곡 폼 다이얼로그 */}
      <SongFormDialog
        key={editingSong?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        albums={albums}
        song={editingSong}
        onSuccess={handleSuccess}
      />

      {/* 삭제 확인 다이얼로그 */}
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
            <Button variant="destructive" onClick={handleDelete}>
              삭제
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
