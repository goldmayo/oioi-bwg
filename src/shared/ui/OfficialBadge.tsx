import { cva, type VariantProps } from "class-variance-authority";
import { Check } from "lucide-react";
import * as React from "react";

import { Badge } from "@/shared/ui/badge";
import { cn } from "@/shared/utils/utils";

const officialBadgeVariants = cva("flex items-center gap-1 border-none font-black text-white", {
  variants: {
    type: {
      default: "bg-white/10",
      q: "bg-qwer-q",
      w: "bg-qwer-w",
      e: "bg-qwer-e",
      r: "bg-qwer-r",
    },
    size: {
      sm: "px-1 py-0 text-[8px]",
      md: "px-1.5 py-0.5 text-[9px]",
      base: "px-2 py-0.5 text-[10px]",
      lg: "px-2.5 py-1 text-[12px]",
    },
  },
  defaultVariants: {
    type: "r",
    size: "base",
  },
});

const iconSizes = {
  sm: 8,
  md: 9,
  base: 10,
  lg: 12,
} as const;

interface OfficialBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof officialBadgeVariants> {
  showIcon?: boolean;
}

/**
 * QWER 공식 응원법임을 나타내는 공통 뱃지 컴포넌트
 * cva를 사용하여 다양한 사이즈와 멤버 컬러 테마(type)를 지원합니다.
 */
export function OfficialBadge({
  className,
  type,
  size = "base",
  showIcon = true,
  ...props
}: OfficialBadgeProps) {
  const safeSize = size || "base";
  const iconSize = iconSizes[safeSize as keyof typeof iconSizes] || 10;

  return (
    <Badge
      variant="secondary"
      className={cn(officialBadgeVariants({ type, size: safeSize }), className)}
      {...props}
    >
      {showIcon && <Check size={iconSize} className="stroke-[4px]" />}
      OFFICIAL
    </Badge>
  );
}

export { officialBadgeVariants };
