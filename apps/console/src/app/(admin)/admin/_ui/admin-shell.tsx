"use client";

import { type ReactNode, useState } from "react";
import { Menu, PanelLeft, PanelLeftOpen } from "lucide-react";
import Link from "next/link";

import { adminPaths } from "@/shared/config/admin-routes";
import { AppLogo } from "@/shared/ui/app-logo";
import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

import styles from "./admin-shell.module.css";

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
      className="text-foreground flex min-h-11 min-w-11 items-center gap-2 rounded-md group-data-[collapsed=true]/sidebar:justify-center focus-visible:outline-2 focus-visible:outline-offset-4 md:min-h-8"
    >
      <AppLogo className="md:text-base" />
    </Link>
  );
  const navigation = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-3 md:py-2">{navContent}</div>
      <div className="p-2">{sidebarFooter}</div>
    </>
  );
  return (
    <div className="bg-sidebar text-foreground flex h-dvh min-w-0 flex-col overflow-hidden md:flex-row md:p-2 md:pl-0">
      <aside
        data-collapsed={isMinimized}
        aria-label="관리자 탐색"
        className={`group/sidebar hidden h-full shrink-0 flex-col transition-[width] duration-200 motion-reduce:transition-none md:flex ${isMinimized ? "w-14" : "w-48"}`}
      >
        <div
          className={`flex h-10 shrink-0 items-center px-3 ${isMinimized ? "justify-center" : "justify-between"}`}
        >
          {isMinimized ? (
            <Button
              variant="ghost"
              size="icon"
              className="group/brand relative size-8"
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
                className="absolute size-4 opacity-0 transition-opacity group-hover/brand:opacity-100 group-focus-visible/brand:opacity-100"
                aria-hidden="true"
              />
            </Button>
          ) : (
            <>
              {brand}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                aria-label="사이드바 접기"
                title="사이드바 접기"
                aria-expanded
                onClick={() => setIsMinimized(true)}
              >
                <PanelLeft className="size-4" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
        {navigation}
      </aside>
      <div className="bg-background border-border flex min-h-0 min-w-0 flex-1 flex-col md:rounded-lg md:border">
        <header className="border-border flex min-h-13 shrink-0 items-center justify-between gap-2 border-b px-3 md:min-h-10 md:px-4">
          <div className="md:hidden">
            <Link
              href={adminPaths.dashboard}
              aria-label="OIOIBWG 대시보드 홈"
              className="flex size-11 items-center justify-center rounded-md focus-visible:outline-2"
            >
              <AppLogo compact />
            </Link>
          </div>
          {breadcrumbs}
          <div className="ml-auto flex shrink-0 items-center gap-0.5">
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
                aria-describedby={undefined}
                className={`${styles.mobileSidebar} bg-sidebar flex w-64 flex-col gap-0 p-0`}
                onClick={(event) => {
                  if (event.target instanceof Element && event.target.closest("a"))
                    setMobileOpen(false);
                }}
              >
                <SheetHeader className="px-6 py-5">
                  <SheetTitle className="sr-only">OIOIBWG</SheetTitle>
                  {brand}
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
