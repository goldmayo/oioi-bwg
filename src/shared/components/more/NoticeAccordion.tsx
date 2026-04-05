"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

import { cn } from "@/shared/utils/utils";

interface NoticeAccordionProps {
  notice: {
    id: number;
    title: string;
    date: string;
    category: string;
    content: string;
  };
}

/**
 * [RENEWAL] 인터랙션이 필요한 아코디언 컴포넌트만 클라이언트로 분리
 */
export function NoticeAccordion({ notice }: NoticeAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={cn(
        "border-border overflow-hidden rounded-2xl border shadow-lg transition-all duration-300",
        isOpen
          ? "bg-accent/20 border-border/80 ring-border/20 ring-1"
          : "bg-card hover:bg-accent/10",
      )}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-6 text-left"
      >
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <span className="text-qwer-q/60 text-2xs font-black tracking-widest uppercase">
              {notice.category}
            </span>
            <span className="text-muted-foreground text-2xs font-bold tracking-widest uppercase tabular-nums">
              {notice.date}
            </span>
          </div>
          <span className="text-foreground text-lg leading-tight font-black">{notice.title}</span>
        </div>
        <ChevronRight
          className={cn(
            "text-muted-foreground/30 h-6 w-6 transition-transform duration-500",
            isOpen && "text-qwer-q/60 rotate-90 opacity-100",
          )}
        />
      </button>
      <div
        className={cn(
          "grid transition-all duration-500 ease-in-out",
          isOpen
            ? "border-border grid-rows-[1fr] border-t opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <div className="text-muted-foreground bg-muted/30 p-6 text-base leading-relaxed">
            {notice.content}
          </div>
        </div>
      </div>
    </div>
  );
}
