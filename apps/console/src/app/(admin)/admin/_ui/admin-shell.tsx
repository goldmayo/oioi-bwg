"use client";

import { type ReactNode, useState } from "react";
import { Menu, PanelLeft, PanelLeftOpen } from "lucide-react";
import Link from "next/link";

import { adminPaths } from "@/shared/config/admin-routes";
import { AppLogo } from "@/shared/ui/app-logo";
import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

export function AdminShell({
  navigation: navContent,
  breadcrumbs,
  headerActions,
  sidebarFooter,
  children,
}: {
  navigation: ReactNode;
  breadcrumbs: ReactNode;
  headerActions: ReactNode;
  sidebarFooter: ReactNode;
  children?: ReactNode;
}) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const brand = (
    <Link
      href={adminPaths.dashboard}
      aria-label="OIOIBWG 대시보드 홈"
      className="text-foreground flex min-h-11 min-w-11 items-center gap-2 rounded-md group-data-[collapsed=true]/sidebar:justify-center focus-visible:outline-2 focus-visible:outline-offset-4"
    >
      <AppLogo />
    </Link>
  );
  const navigation = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-5">{navContent}</div>
      <div className="p-3">{sidebarFooter}</div>
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
          className={`flex h-20 shrink-0 items-center px-3 ${isMinimized ? "justify-center" : "justify-between"}`}
        >
          {isMinimized ? (
            <Button
              variant="ghost"
              size="icon"
              className="group/brand relative size-11"
              aria-label="사이드바 열기"
              title="사이드바 열기"
              aria-expanded={false}
              onClick={() => setIsMinimized(false)}
            >
              <span
                className="inline-flex transition-opacity group-hover/brand:opacity-0 group-focus-visible/brand:opacity-0"
                aria-hidden="true"
              >
                <AppLogo compact />
              </span>
              <PanelLeftOpen
                className="absolute size-5 opacity-0 transition-opacity group-hover/brand:opacity-100 group-focus-visible/brand:opacity-100"
                aria-hidden="true"
              />
            </Button>
          ) : (
            <>
              {brand}
              <Button
                variant="ghost"
                size="icon"
                className="size-11"
                aria-label="사이드바 접기"
                title="사이드바 접기"
                aria-expanded
                onClick={() => setIsMinimized(true)}
              >
                <PanelLeft className="size-5" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
        {navigation}
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="bg-background border-border flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3 md:min-h-20">
          <div className="md:hidden">{brand}</div>
          {breadcrumbs}
          <div className="ml-auto flex items-center gap-2">
            {headerActions}
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
                <SheetHeader className="px-6 py-5">
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
