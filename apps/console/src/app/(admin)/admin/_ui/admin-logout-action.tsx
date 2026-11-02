"use client";

import { LogOut } from "lucide-react";

import { useSignOut } from "@/features/auth";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";

export function AdminLogoutAction() {
  const logout = useSignOut();
  return (
    <Dialog
      open={logout.open}
      onOpenChange={(open) => {
        if (open) logout.request();
        else logout.cancel();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-destructive min-h-11 w-full justify-start gap-3 px-3 group-data-[collapsed=true]/sidebar:justify-center"
          aria-label="로그아웃"
          aria-busy={logout.pending}
          disabled={logout.pending}
        >
          <LogOut size={18} aria-hidden="true" />
          <span className="group-data-[collapsed=true]/sidebar:hidden">
            {logout.pending ? "로그아웃 중…" : "로그아웃"}
          </span>
        </Button>
      </DialogTrigger>
      <DialogContent showCloseButton={false} role="alertdialog">
        <DialogHeader>
          <DialogTitle>로그아웃하시겠습니까?</DialogTitle>
          <DialogDescription>관리자 세션을 종료합니다.</DialogDescription>
        </DialogHeader>
        {logout.error && (
          <p role="alert" className="text-destructive text-sm">
            {logout.error}
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={logout.cancel}>
            취소
          </Button>
          <Button type="button" onClick={logout.confirm}>
            로그아웃
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
