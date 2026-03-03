import Link from "next/link";
import { ReactNode } from "react";

/**
 * 사용자 페이지 공통 레이아웃 (Header 포함)
 */
export default function UserLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* 글로벌 헤더 */}
      <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Link href="/" className="group flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-qwer-w transition-transform group-hover:scale-150" />
            <span className="text-lg font-black tracking-tighter text-foreground uppercase">
              OiOi<span className="text-qwer-w">Bawige</span>
            </span>
          </Link>
          
          <nav className="flex items-center gap-6">
            <Link 
              href="/" 
              className="text-xs font-bold tracking-widest text-muted-foreground uppercase transition-colors hover:text-foreground"
            >
              Albums
            </Link>
            <Link 
              href="/admin" 
              className="rounded-full bg-accent px-4 py-1.5 text-[10px] font-black tracking-widest text-accent-foreground uppercase transition-all hover:bg-primary hover:text-primary-foreground"
            >
              Admin
            </Link>
          </nav>
        </div>
      </header>

      {/* 페이지 콘텐츠 */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
}
