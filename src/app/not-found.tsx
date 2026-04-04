import Link from "next/link";

import { Button } from "@/shared/ui/button";

/**
 * 프로젝트 통합 404 페이지 (OiOiBawige 스타일)
 */
export default function NotFound() {
  return (
    <section className="bg-background flex min-h-[calc(100dvh-200px)] flex-col items-center justify-center gap-6 text-center">
      <div className="flex flex-col gap-6">
        {/* 404 배경 텍스트 */}
        <h1 className="text-qwer-w/50 text-8xl font-black tracking-tighter md:text-9xl">404</h1>
        {/* 중앙 메시지 */}
        <div className="flex flex-col items-center justify-center">
          <p className="text-foreground text-xl font-bold md:text-2xl">
            페이지를 찾을 수 없습니다.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="secondary" size="lg">
          <Link href="/">메인으로 돌아가기</Link>
        </Button>
      </div>
    </section>
  );
}
