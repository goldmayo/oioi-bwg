import { cn } from "../lib/utils";

export function AppLogo({ compact = false, className }: { compact?: boolean; className?: string }) {
  return (
    <span
      role="img"
      aria-label="어이어이 바위게"
      className={cn(
        "inline-flex items-center gap-2 text-lg",
        !compact &&
          "relative isolate before:absolute before:-inset-x-1.5 before:-inset-y-0.5 before:-z-10 before:rounded-sm before:bg-[#151617] dark:before:bg-transparent",
        className,
      )}
    >
      <span className="bg-qwer-rockation size-2 shrink-0 rounded-full" aria-hidden="true" />
      {!compact && (
        <span className="font-black tracking-tighter text-[#ececee]" aria-hidden="true">
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
