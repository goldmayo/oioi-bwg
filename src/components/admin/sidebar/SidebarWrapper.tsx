"use client";

import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";

import { signOut } from "@/app/admin/actions";
import { Button } from "@/components/ui/button";

export function SidebarWrapper({ children }: { children: React.ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);

  return (
    <aside
      className={`border-border bg-card relative flex h-screen flex-col border-r shadow-sm transition-all duration-300 ease-in-out ${
        isMinimized ? "w-16" : "w-64"
      }`}
    >
      {/* Sidebar Header */}
      <div
        className={`border-border/50 flex h-16 shrink-0 items-center border-b px-4 ${
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

      {/* Main Content Area (Accordion) */}
      <div className="flex-1 overflow-y-auto px-2 py-4">
        {!isMinimized ? (
          children
        ) : (
          <div className="flex flex-col items-center gap-4 py-4">
            {/* 최소화 상태에서 보여줄 아이콘이나 요소가 필요하다면 여기에 추가 */}
          </div>
        )}
      </div>

      {/* Sidebar Footer (Logout) */}
      <div className="border-border/50 mt-auto border-t p-2">
        <Button
          variant="ghost"
          className={`text-muted-foreground hover:bg-destructive/10 hover:text-destructive w-full justify-start gap-3 transition-colors ${
            isMinimized ? "justify-center px-0" : "px-3"
          }`}
          onClick={() => {
            if (confirm("로그아웃 하시겠습니까?")) {
              signOut();
            }
          }}
          title="로그아웃"
        >
          <LogOut size={16} />
          {!isMinimized && <span className="text-xs font-bold">Logout</span>}
        </Button>
      </div>
    </aside>
  );
}
