"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { EllipsisVertical, SquarePen, Trash2 } from "lucide-react";
import { Popover } from "radix-ui";

import { Button } from "./button";

export function TableActionsHeader() {
  return <span className="inline-flex size-9 items-center justify-center">관리</span>;
}

/** 팝오버 표시만 소유한다. 권한·삭제 자격·링크는 소비처가 결정한다. */
export function TableRowActions({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="ghost" size="icon" aria-label={`${label} 관리`} title={`${label} 관리`}>
          <EllipsisVertical aria-hidden="true" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={4}
          aria-label={`${label} 작업`}
          className="bg-popover text-popover-foreground shadow-menu z-50 flex min-w-28 flex-col gap-1 rounded-md border p-1"
          onClick={(event) => {
            if (event.target instanceof Element && event.target.closest("button:not(:disabled), a"))
              setOpen(false);
          }}
        >
          {children}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function TableEditAction({ href, onClick }: { href?: string; onClick?: () => void }) {
  const content = (
    <>
      <SquarePen aria-hidden="true" />
      편집
    </>
  );
  return (
    <Button variant="ghost" className="justify-start" asChild={!!href} onClick={onClick}>
      {href ? <a href={href}>{content}</a> : content}
    </Button>
  );
}

export function TableDeleteAction({
  onClick,
  disabled,
  title,
}: {
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <Button
      variant="ghost"
      className="text-destructive hover:bg-destructive/10 hover:text-destructive justify-start"
      onClick={onClick}
      disabled={disabled}
      title={title}
    >
      <Trash2 aria-hidden="true" />
      삭제
    </Button>
  );
}
