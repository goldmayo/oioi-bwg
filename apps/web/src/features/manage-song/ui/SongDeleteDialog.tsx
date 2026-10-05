"use client";

import type { AdminSongSummary } from "@/entities/song";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

interface Props {
  song: AdminSongSummary | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function SongDeleteDialog({ song, pending, onClose, onConfirm }: Props) {
  return (
    <Dialog open={!!song} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>곡 삭제</DialogTitle>
          <DialogDescription>
            <strong>&ldquo;{song?.title}&rdquo;</strong> 곡을 삭제하시겠습니까?
            <br />이 작업은 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button variant="destructive" disabled={pending} onClick={onConfirm}>
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
