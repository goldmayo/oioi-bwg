"use client";
import { useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";

import { notificationQueries } from "@/entities/notification";

import { Button } from "@/shared/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/shared/ui/sheet";

import { NotificationInbox } from "./notification-inbox";
import { useNotificationContext } from "./notification-provider";
export function NotificationBell() {
  const { accountId } = useNotificationContext();
  const list = useInfiniteQuery(notificationQueries.list(accountId));
  const count = list.data?.pages[0]?.unreadCount ?? 0;
  const [open, setOpen] = useState(false);
  return (
    <Sheet
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) void list.refetch();
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-11 shrink-0"
          aria-label={`알림, 읽지 않은 알림 ${count}개`}
        >
          <Bell size={20} aria-hidden="true" />
          {count ? (
            <span
              aria-hidden="true"
              className="bg-primary text-primary-foreground absolute top-0 right-0 flex min-w-4 items-center justify-center rounded-full px-1 text-xs leading-4 font-semibold tabular-nums"
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="bg-popover flex w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-border border-b p-6 pr-12">
          <SheetTitle>알림</SheetTitle>
          <SheetDescription>작업 결과와 놓친 알림을 확인합니다.</SheetDescription>
        </SheetHeader>
        <NotificationInbox onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
