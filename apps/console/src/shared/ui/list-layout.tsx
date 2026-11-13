import type { ReactNode } from "react";

import { cn } from "../lib/utils";

import { Button } from "./button";

export function ListHeader({
  title,
  description,
  action,
  compactOnMobile = false,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  compactOnMobile?: boolean;
}) {
  return (
    <header
      className={cn(
        "flex flex-wrap items-start justify-between gap-4",
        compactOnMobile && "max-md:items-center max-md:gap-3",
      )}
    >
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
        <p
          className={cn(
            "text-muted-foreground mt-2 text-sm leading-6",
            compactOnMobile && "max-md:hidden",
          )}
        >
          {description}
        </p>
      </div>
      {action}
    </header>
  );
}

export function ListToolbar({
  selection,
  actions,
  children,
}: {
  selection?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 md:flex md:flex-wrap md:items-start md:justify-between md:space-y-0 md:gap-x-3 md:gap-y-2">
      <div className="min-w-0 md:flex-1">{children}</div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 has-[>div:empty+div:empty]:hidden md:contents">
        <div className="empty:hidden md:order-first md:basis-full">{selection}</div>
        <div className="empty:hidden">{actions}</div>
      </div>
    </div>
  );
}

export function ListSelection({
  count,
  onClear,
  disabled,
}: {
  count: number;
  onClear: () => void;
  disabled?: boolean;
}) {
  if (count === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground" role="status">
        {count}개 선택됨
      </span>
      <Button
        type="button"
        variant="link"
        disabled={disabled}
        className="text-foreground h-9 px-1 underline decoration-current/50 underline-offset-4 hover:decoration-current"
        onClick={onClear}
      >
        선택 해제
      </Button>
    </div>
  );
}
