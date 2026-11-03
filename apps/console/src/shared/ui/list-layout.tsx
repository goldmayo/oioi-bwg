import type { ReactNode } from "react";

import { Button } from "./button";

export function ListHeader({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground mt-2 text-sm leading-6">{description}</p>
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
    <div className="space-y-2">
      {selection}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {actions}
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
