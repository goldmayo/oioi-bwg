"use client";

import { Edit, FileMusic, Trash2 } from "lucide-react";
import Link from "next/link";

import type { AdminSongSummary } from "@/entities/song";

import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

interface Props {
  songs: AdminSongSummary[];
  canManage: boolean;
  hasFilter: boolean;
  onEdit: (song: AdminSongSummary) => void;
  onDelete: (song: AdminSongSummary) => void;
}

export function SongManagerTable({ songs, canManage, hasFilter, onEdit, onDelete }: Props) {
  return (
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
          {songs.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground py-8 text-center">
                <FileMusic className="mx-auto mb-2 h-8 w-8 opacity-50" />
                {hasFilter ? "검색 결과가 없습니다." : "등록된 곡이 없습니다."}
              </TableCell>
            </TableRow>
          ) : (
            songs.map((song) => (
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
                        onClick={() => onEdit(song)}
                        title="수정"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:bg-destructive/10 h-8 w-8"
                        onClick={() => onDelete(song)}
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
  );
}
