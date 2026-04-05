import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { cn } from "@/shared/utils/utils";

interface MoreBackButtonProps {
  href?: string;
  label?: string;
  className?: string;
}

/**
 * [RENEWAL] 더보기 상부 경로 이동 버튼 (디자인 토큰 적용)
 */
export function MoreBackButton({
  href = "/more",
  label = "Back to More",
  className,
}: MoreBackButtonProps) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cn(
        "group text-muted-foreground hover:text-foreground flex items-center gap-2 transition-colors",
        className,
      )}
    >
      <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-1" />
      <span className="text-2xs leading-none font-bold tracking-widest uppercase">{label}</span>
    </Link>
  );
}

interface MoreHeaderProps {
  title: string;
  subTitle?: string;
  className?: string;
}

/**
 * [RENEWAL] 더보기 하위에 공통으로 사용되는 헤더 (반응형 텍스트 크기 최적화)
 */
export function MoreHeader({ title, subTitle, className }: MoreHeaderProps) {
  return (
    <header className={cn("mb-12 px-2", className)}>
      {subTitle && (
        <h1 className="text-muted-foreground sm:text-2xs mb-3 text-[10px] font-black tracking-[0.3rem] uppercase lg:tracking-[0.5rem]">
          {subTitle}
        </h1>
      )}
      <h2 className="text-foreground text-3xl font-black tracking-tighter sm:text-4xl lg:text-5xl xl:text-6xl">
        {title}
      </h2>
    </header>
  );
}
