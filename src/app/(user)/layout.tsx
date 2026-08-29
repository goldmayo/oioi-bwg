import { ReactNode } from "react";

import { Footer } from "@/shared/ui/Footer";
import { BottomNav } from "@/shared/ui/navigation/BottomNav";
import { GlobalNav } from "@/shared/ui/navigation/GlobalNav";
import { MobileHeader } from "@/shared/ui/navigation/MobileHeader";

/**
 * 사용자 페이지 공통 레이아웃.
 */
export default function UserLayout({
  children,
  modal,
}: {
  children: ReactNode;
  modal?: ReactNode;
}) {
  return (
    <div className="bg-background flex min-h-dvh">
      {/* PC 전용 좌측 사이드바 (LNB) */}
      <GlobalNav />
      <div className="flex w-full flex-col pb-[68px] md:pt-[72px]">
        {/* 모바일 전용 상단 로고 헤더 */}
        <MobileHeader />
        <main className="flex-1">
          {children}
          {modal}
        </main>
        <Footer />
      </div>

      {/* 모바일 전용 하단 탭 네비게이션 */}
      <BottomNav />
    </div>
  );
}
