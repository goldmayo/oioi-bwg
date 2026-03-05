import { House } from "lucide-react";
import Link from "next/link";
import { ReactNode } from "react";

/**
 * 사용자 페이지 공통 레이아웃 (Parallel Routes 지원)
 * @modal 슬롯을 추가하여 Intercepting Routes가 이 영역에 렌더링되도록 합니다.
 */
export default function UserLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal: ReactNode; // 모달 슬롯 추가
}) {
  return (
    <div className="bg-background flex h-dvh flex-col overflow-hidden">
      {/* 글로벌 헤더 */}
      <header className="bg-background/80 w-full shrink-0 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
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
              <House size={24} />
            </Link>
          </nav>
        </div>
      </header>

      {/* 페이지 콘텐츠 */}
      <main className="custom-scrollbar ios-touch relative min-h-0 flex-1 overflow-y-auto">
        {children}
        {modal} {/* 가로채기 모달이 이곳에 렌더링됩니다 */}
      </main>
    </div>
  );
}
