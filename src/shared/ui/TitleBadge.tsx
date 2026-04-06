import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/utils";

const titleBadgeVariants = cva(
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

interface TitleBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof titleBadgeVariants> {}

/**
 * 앨범의 타이틀곡임을 나타내는 뱃지 컴포넌트
 * 화려한 그라데이션과 그림자 효과로 주목도를 높였습니다.
 */
export function TitleBadge({ className, theme, size = "md", ...props }: TitleBadgeProps) {
  const safeSize = size || "md";

  return (
    <Badge
      variant="secondary"
      className={cn(titleBadgeVariants({ theme, size: safeSize }), className)}
      {...props}
    >
      <span>TITLE</span>
    </Badge>
  );
}

export { titleBadgeVariants };
