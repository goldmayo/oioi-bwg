import { cn } from "../lib/utils";

export function AppLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label="어이어이 바위게"
      className={cn("inline-flex items-center gap-2 text-lg", className)}
    >
      <span className="bg-qwer-rockation size-2 shrink-0 rounded-full" aria-hidden="true" />
      {!compact && (
        <span className="text-foreground font-black tracking-tighter" aria-hidden="true">
          <span>O</span>
          <span className="text-qwer-w">I</span>
          <span className="text-qwer-e">O</span>
          <span className="text-qwer-r">I</span>
          <span>BWG</span>
        </span>
      )}
    </span>
  );
}
