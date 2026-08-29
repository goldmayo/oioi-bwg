"use client";

import { useState } from "react";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { signOut } from "@/features/auth/actions";

import { Button } from "@/shared/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";

/**
 * 사이드바 래퍼 (데스크톱: 고정 aside, 모바일: Sheet 슬라이드)
 */
export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);

  const sidebarContent = (
    <>
      {/* 내비게이션 콘텐츠 */}
      <div className="flex-1 overflow-y-auto px-2 py-4">{children}</div>

      {/* 로그아웃 */}
      <div className="border-border/50 mt-auto border-t p-2">
        <Button
          variant="ghost"
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full justify-start gap-3 px-3 transition-colors"
          onClick={() => {
            if (confirm("로그아웃 하시겠습니까?")) {
              void signOut();
            }
          }}
          title="로그아웃"
        >
          <LogOut size={16} />
          <span className="text-xs font-bold">Logout</span>
        </Button>
      </div>
    </>
  );

  return (
    <>
      {/* ── 모바일: 상단 바 + Sheet ── */}
      <div className="bg-card border-border flex h-14 items-center justify-between border-b px-4 md:hidden">
        <h2 className="text-foreground text-sm font-bold tracking-tight uppercase">Admin</h2>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Menu size={18} />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="flex w-64 flex-col p-0">
            <SheetHeader className="border-border/50 border-b px-4 py-4">
              <SheetTitle className="text-sm font-bold tracking-tight uppercase">
                Admin Panel
              </SheetTitle>
            </SheetHeader>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      </div>

      {/* ── 데스크톱: 고정 사이드바 ── */}
      <aside
        className={`border-border bg-card hidden h-screen flex-col border-r shadow-sm transition-all duration-300 ease-in-out md:flex ${
          isMinimized ? "w-16" : "w-56"
        }`}
      >
        {/* Header */}
        <div
          className={`border-border/50 flex h-14 shrink-0 items-center border-b px-4 ${
            isMinimized ? "justify-center" : "justify-between"
          }`}
        >
          {!isMinimized && (
            <h2 className="text-foreground text-sm font-bold tracking-tight uppercase">
              Admin Panel
            </h2>
          )}
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-8 w-8"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? "사이드바 열기" : "사이드바 접기"}
          >
            {isMinimized ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
          </Button>
        </div>

        {/* 콘텐츠 */}
        {isMinimized ? (
          <div className="flex flex-1 flex-col items-center gap-4 px-2 py-4">
            {/* 최소화 시 아이콘만 표시하려면 여기에 */}
          </div>
        ) : (
          sidebarContent
        )}
      </aside>
    </>
  );
}
