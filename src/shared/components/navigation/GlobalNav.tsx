import Link from "next/link";

import { NavLinks } from "@/shared/components/navigation/NavLinks";

/**
 * 전역 상단 네비게이션 (서버 컴포넌트)
 * 페이지 렌더링 최적화를 위해 CSS와 레이아웃은 서버에서 그리고,
 * 라우팅 상태(활성화 색상)만 NavLinks 클라이언트 컴포넌트가 담당합니다.
 */
export function GlobalNav() {
  return (
    <header className="bg-background/80 fixed top-0 left-1/2 z-40 container hidden h-[72px] w-full -translate-x-1/2 items-center justify-between border-b px-8 backdrop-blur-xl transition-all md:flex">
      {/* 로고 영역 (왼쪽) */}
      <Link href="/" className="group flex items-center gap-2">
        <div className="bg-qwer-rockation h-2 w-2 rounded-full transition-transform group-hover:scale-150" />
        <span className="text-foreground text-lg font-black tracking-tighter uppercase">
          <span className="text-qwer-q">O</span>
          <span className="text-qwer-w">I</span>
          <span className="text-qwer-e">O</span>
          <span className="text-qwer-r">I</span>
          <span className="text-white">BWG</span>
        </span>
      </Link>

      {/* 네비게이션 메뉴 (중앙) - 클라이언트 위임 */}
      <NavLinks />
    </header>
  );
}
