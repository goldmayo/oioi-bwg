import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/shared/lib/utils";
import { Badge } from "@/shared/ui/badge";

const songTitleBadgeVariants = cva(
  "inline-flex items-center justify-center gap-1 border-none font-bold leading-none tracking-wide text-white transition-all hover:scale-105",
  {
    variants: {
      theme: {
        default: "bg-linear-to-r from-qwer-bwg to-qwer-e shadow-[0_0_8px_rgba(66,127,151,0.4)]",
        premium: "bg-linear-to-r from-amber-400 to-amber-600 shadow-[0_0_8px_rgba(251,191,36,0.5)]",
        rock: "bg-linear-to-r from-qwer-rockation to-[#ef87b5] shadow-[0_0_8px_rgba(230,125,140,0.4)]",
      },
      size: {
        sm: "h-[14px] text-[8px] ",
        md: "h-[18px] text-[10px] ",
        lg: "h-[22px] text-[12px] ",
      },
    },
    defaultVariants: {
      theme: "default",
      size: "md",
    },
  },
);

interface SongTitleBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof songTitleBadgeVariants> {}

/** 곡이 앨범의 타이틀곡임을 나타내는 Song 표현 컴포넌트다. */
export function SongTitleBadge({ className, theme, size = "md", ...props }: SongTitleBadgeProps) {
  const safeSize = size || "md";

  return (
    <Badge
      variant="secondary"
      className={cn(songTitleBadgeVariants({ theme, size: safeSize }), className)}
      {...props}
    >
      <span>TITLE</span>
    </Badge>
  );
}

export { songTitleBadgeVariants };
