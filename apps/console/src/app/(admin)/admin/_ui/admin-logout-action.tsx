"use client";

import { LogOut } from "lucide-react";

import { requestSignOut } from "@/features/auth";

import { Button } from "@/shared/ui/button";

export function AdminLogoutAction() {
  return (
    <Button
      variant="ghost"
      className="text-muted-foreground hover:text-destructive min-h-11 w-full justify-start gap-3 px-3 group-data-[collapsed=true]/sidebar:justify-center"
      aria-label="로그아웃"
      onClick={requestSignOut}
    >
      <LogOut size={18} aria-hidden="true" />
      <span className="group-data-[collapsed=true]/sidebar:hidden">로그아웃</span>
    </Button>
  );
}
