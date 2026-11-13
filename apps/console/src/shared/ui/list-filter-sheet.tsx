"use client";

import type { ReactNode } from "react";
import { SlidersHorizontal } from "lucide-react";

import { Button } from "./button";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "./sheet";

export function ListFilterSheet({
  title,
  description,
  activeCount = 0,
  children,
}: {
  title: string;
  description: string;
  activeCount?: number;
  children: ReactNode;
}) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="secondary" className="h-11 shrink-0 gap-1.5 md:h-9">
          <SlidersHorizontal aria-hidden="true" className="size-4" />
          필터
          {activeCount > 0 && <span className="tabular-nums">{activeCount}</span>}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="bg-popover mx-auto max-h-dvh max-w-lg overflow-y-auto rounded-t-xl px-4 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="p-0 text-left">
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="grid gap-3">{children}</div>
        <SheetClose asChild>
          <Button type="button" className="h-11">
            완료
          </Button>
        </SheetClose>
      </SheetContent>
    </Sheet>
  );
}
