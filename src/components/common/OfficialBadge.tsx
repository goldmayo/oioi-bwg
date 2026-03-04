import { Check } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/libs/utils";

interface OfficialBadgeProps {
  className?: string;
  showIcon?: boolean;
}

/**
 * QWER 공식 응원법임을 나타내는 공통 뱃지 컴포넌트
 */
export function OfficialBadge({ className, showIcon = true }: OfficialBadgeProps) {
  return (
    <Badge
      variant="secondary"
      className={cn(
        "bg-qwer-r/10 text-qwer-r flex items-center gap-1 border-none px-2 py-0.5 text-[10px] font-black",
        className,
      )}
    >
      {showIcon && <Check size={10} className="stroke-[4px]" />}
      OFFICIAL
    </Badge>
  );
}
