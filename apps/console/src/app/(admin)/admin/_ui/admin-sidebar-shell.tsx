"use client";

import { useState } from "react";
import { LayoutDashboard, LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/features/auth";

import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

import { NotificationBell } from "./notification-bell";

export function AdminSidebarShell({ children }: { children: React.ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const brand = (
    <Link
      href="/admin"
      aria-label="대시보드 홈"
      className="text-foreground flex min-h-11 items-center gap-2 rounded-md font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <LayoutDashboard className="size-5 shrink-0" aria-hidden="true" />
      <span className="text-sm group-data-[collapsed=true]/sidebar:hidden">OIOIBWG</span>
    </Link>
  );
  const navigation = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">{children}</div>
      <div className="border-sidebar-border border-t p-3">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-foreground hidden min-h-11 w-full justify-start gap-3 px-3 group-data-[collapsed=true]/sidebar:justify-center md:flex"
          onClick={() => setIsMinimized(!isMinimized)}
          aria-label={isMinimized ? "사이드바 열기" : "사이드바 접기"}
          aria-expanded={!isMinimized}
        >
          {isMinimized ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          <span className="group-data-[collapsed=true]/sidebar:hidden">메뉴 접기</span>
        </Button>
        <Button
          variant="ghost"
          className="text-muted-foreground hover:text-destructive min-h-11 w-full justify-start gap-3 px-3 group-data-[collapsed=true]/sidebar:justify-center"
          aria-label="로그아웃"
          onClick={() => {
            if (confirm("로그아웃하시겠습니까?")) void signOut();
          }}
        >
          <LogOut size={18} aria-hidden="true" />
          <span className="group-data-[collapsed=true]/sidebar:hidden">로그아웃</span>
        </Button>
      </div>
    </>
  );
  return (
    <>
      <header className="bg-sidebar border-sidebar-border flex h-16 shrink-0 items-center justify-between border-b px-4 md:hidden">
        {brand}
        <div className="flex items-center gap-2">
          <NotificationBell />
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="size-11" aria-label="관리자 메뉴 열기">
                <Menu size={20} />
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="bg-sidebar flex w-64 flex-col gap-0 p-0"
              onClick={(event) => {
                if (event.target instanceof Element && event.target.closest("a"))
                  setMobileOpen(false);
              }}
            >
              <SheetHeader className="border-sidebar-border border-b px-6 py-5">
                <SheetTitle>OIOIBWG</SheetTitle>
                <SheetDescription>관리자 메뉴</SheetDescription>
              </SheetHeader>
              {navigation}
            </SheetContent>
          </Sheet>
        </div>
      </header>
      <aside
        data-collapsed={isMinimized}
        aria-label="관리자 탐색"
        className={`group/sidebar bg-sidebar border-sidebar-border hidden h-full shrink-0 flex-col border-r transition-[width] duration-200 motion-reduce:transition-none md:flex ${isMinimized ? "w-20" : "w-60"}`}
      >
        <div
          className={`border-sidebar-border flex shrink-0 items-center border-b px-5 ${isMinimized ? "h-28 flex-col justify-center gap-1" : "h-20 justify-between gap-2"}`}
        >
          {brand}
          <NotificationBell />
        </div>
        {navigation}
      </aside>
    </>
  );
}
