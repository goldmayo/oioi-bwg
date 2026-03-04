import Link from "next/link";
import { ReactNode } from "react";

/**
 * 사용자 페이지 공통 레이아웃 (Viewport 고정형)
 * 전체 화면을 100dvh로 고정하여 외부 스크롤을 차단하고,
 * 자식 컴포넌트가 남은 공간을 효율적으로 활용하게 합니다.
 */
export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      {/* 글로벌 헤더 (고정 높이) */}
      <header className="border-border/50 bg-background/80 w-full shrink-0 border-b backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="group flex items-center gap-2">
            <div className="bg-qwer-w h-2 w-2 rounded-full transition-transform group-hover:scale-150" />
            <span className="text-foreground text-lg font-black tracking-tighter uppercase">
              OiOi<span className="text-qwer-w">Bawige</span>
            </span>
          </Link>

          <nav className="flex items-center gap-6">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground text-xs font-bold tracking-widest uppercase transition-colors"
            >
              Albums
            </Link>
            <Link
              href="/admin"
              className="bg-accent text-accent-foreground hover:bg-primary hover:text-primary-foreground rounded-full px-4 py-1.5 text-[10px] font-black tracking-widest uppercase transition-all"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* 페이지 콘텐츠 (남은 모든 공간 차지) */}
      <main className="custom-scrollbar ios-touch relative min-h-0 flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
