import { ReactNode } from "react";

import { BottomNav } from "@/shared/components/navigation/BottomNav";
import { GlobalNav } from "@/shared/components/navigation/GlobalNav";
import { MobileHeader } from "@/shared/components/navigation/MobileHeader";
import { Footer } from "@/shared/ui/Footer";

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
    <div className="bg-background flex min-h-dvh">
      {/* PC 전용 좌측 사이드바 (LNB) */}
      <GlobalNav />
      <div className="flex w-full flex-col pb-[68px] md:pt-[72px]">
        {/* 모바일 전용 상단 로고 헤더 */}
        <MobileHeader />
        <main className="flex-1">
          {children}
          {modal} {/* 가로채기 모달 렌더링 영역 */}
        </main>
        <Footer />
      </div>

      {/* 모바일 전용 하단 탭 네비게이션 */}
      <BottomNav />
    </div>
  );
}
