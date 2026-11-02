"use client";

import { useState } from "react";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import Link from "next/link";

import { signOut } from "@/features/auth";

import { adminPaths } from "@/shared/config/admin-routes";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

import type { AdminBreadcrumb } from "../_config/admin-navigation";

import { AdminBreadcrumbs } from "./admin-breadcrumbs";
import { NotificationBell } from "./notification-bell";

export function AdminShell({
  navigation: navContent,
  breadcrumbs,
  children,
}: {
  navigation: React.ReactNode;
  breadcrumbs: AdminBreadcrumb[];
  children?: React.ReactNode;
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const brand = (
    <Link
      href={adminPaths.dashboard}
      aria-label="OIOIBWG 대시보드 홈"
      className="text-foreground flex min-h-11 min-w-11 items-center gap-2 rounded-md group-data-[collapsed=true]/sidebar:justify-center focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <span className="bg-qwer-rockation size-2 shrink-0 rounded-full" aria-hidden="true" />
      <span
        className="text-lg font-black tracking-tighter group-data-[collapsed=true]/sidebar:hidden"
        aria-hidden="true"
      >
        <span className="text-qwer-q">O</span>
        <span className="text-qwer-w">I</span>
        <span className="text-qwer-e">O</span>
        <span className="text-qwer-r">I</span>
        <span>BWG</span>
      </span>
    </Link>
  );
  const navigation = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">{navContent}</div>
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
    <div className="bg-background text-foreground flex h-dvh min-w-0 flex-col overflow-hidden md:flex-row">
      <aside
        data-collapsed={isMinimized}
        aria-label="관리자 탐색"
        className={`group/sidebar bg-sidebar border-sidebar-border hidden h-full shrink-0 flex-col border-r transition-[width] duration-200 motion-reduce:transition-none md:flex ${isMinimized ? "w-20" : "w-60"}`}
      >
        <div
          className={`border-sidebar-border flex h-20 shrink-0 items-center border-b px-5 ${isMinimized ? "justify-center" : "justify-start"}`}
        >
          {brand}
        </div>
        {navigation}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="bg-background border-border flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:min-h-20">
          <div className="md:hidden">{brand}</div>
          <AdminBreadcrumbs items={breadcrumbs} />
          <div className="ml-auto flex items-center gap-2">
            <NotificationBell />
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-11 md:hidden"
                  title="관리자 메뉴 열기"
                  aria-label="관리자 메뉴 열기"
                >
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
                  <SheetTitle className="sr-only">OIOIBWG</SheetTitle>
                  {brand}
                  <SheetDescription>관리자 메뉴</SheetDescription>
                </SheetHeader>
                {navigation}
              </SheetContent>
            </Sheet>
          </div>
        </header>

        <main className="min-h-0 min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
