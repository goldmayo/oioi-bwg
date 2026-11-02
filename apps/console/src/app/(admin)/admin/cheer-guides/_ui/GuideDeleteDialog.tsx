"use client";

import { AdminReauthenticationNotice } from "@/features/auth";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";

import type { useGuideDeletion } from "../_model/use-guide-deletion";

export function GuideDeleteDialog({
  deletion,
  canManage,
}: {
  deletion: ReturnType<typeof useGuideDeletion>;
  canManage: boolean;
}) {
  return (
    <Dialog
      open={deletion.targets.length > 0}
      onOpenChange={(open) => {
        if (!open) deletion.close();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>응원법 삭제</DialogTitle>
          <DialogDescription>
            선택한 {deletion.targets.length}개 응원법을 삭제하시겠습니까? 내용·공개 이력이 없는
            응원법만 삭제하며, 되돌릴 수 없습니다.
          </DialogDescription>
        </DialogHeader>
        <ul className="max-h-48 space-y-1 overflow-y-auto text-sm">
          {deletion.targets.map((guide) => (
            <li key={guide.id}>
              {guide.song.title || "제목 없음"} · {guide.mode === "CONCERT" ? "콘서트" : "페스티벌"}
            </li>
          ))}
        </ul>
        <AdminReauthenticationNotice recovery={deletion.recovery} />
        {deletion.message && (
          <p role="status" className="text-sm">
            {deletion.message}
          </p>
        )}
        {deletion.error && (
          <p role="alert" className="text-destructive text-sm">
            {deletion.error}
          </p>
        )}
        {!canManage && <p className="text-muted-foreground text-sm">관리자 권한을 확인해주세요.</p>}
        <DialogFooter>
          <Button variant="destructiveOutline" disabled={deletion.pending} onClick={deletion.close}>
            취소
          </Button>
          <Button
            variant="destructive"
            disabled={deletion.pending || !canManage || deletion.recovery.requiresReauthentication}
            onClick={() => void deletion.confirm()}
          >
            {deletion.pending ? "삭제 중…" : "삭제"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
