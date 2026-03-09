import React from "react";

/**
 * 전역 푸터 컴포넌트
 * 프로젝트의 비영리 성격과 면책 문구를 명시합니다.
 */
export function Footer() {
  return (
    <footer className="border-border/50 mt-auto border-t py-12 text-center">
      <div className="container mx-auto px-4">
        <div className="mb-6 space-y-2">
          <p className="text-muted-foreground text-base font-bold tracking-[0.3em] uppercase">
            OiOiBWG / Cheer RockCrab — 2026
          </p>
          <p className="text-muted-foreground/60 mx-auto max-w-2xl text-sm leading-relaxed break-keep">
            본 서비스는 팬이 만든 비영리 프로젝트이며, 3Y CORPORATION 과 어떠한 공식적 관계도
            없습니다.
            <br />
            공식 응원법 외의 내용은 작성자의 개인적인 제안일 뿐이므로 자유롭게 참고해 주세요.
          </p>
        </div>

        <div className="flex justify-center gap-4 opacity-30 grayscale transition-all duration-500 hover:opacity-100 hover:grayscale-0">
          {/* 향후 소셜 링크나 관련 링크 추가 공간 */}
        </div>
      </div>
    </footer>
  );
}
