import Link from "next/link";

import { Button } from "@/components/ui/button";

/**
 * 프로젝트 통합 404 페이지 (OiOiBawige 스타일)
 */
export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4 text-center">
      <div className="relative mb-8">
        {/* 404 배경 텍스트 */}
        <h1 className="text-9xl font-black text-muted/20 tracking-tighter">404</h1>
        {/* 중앙 메시지 */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-2xl font-bold text-foreground">바위게야, 길을 잃었니?</p>
          <div className="mt-2 h-1 w-12 bg-qwer-w rounded-full" />
        </div>
      </div>
      
      <p className="max-w-xs text-muted-foreground leading-relaxed">
        찾으시는 페이지가 존재하지 않거나,<br />
        다른 주소로 이동된 것 같아요.
      </p>

      <div className="mt-10 flex gap-3">
        <Button asChild variant="outline" className="border-border">
          <Link href="/">메인으로 돌아가기</Link>
        </Button>
        <Button asChild className="bg-qwer-r text-white hover:bg-qwer-r/90 font-bold">
          <Link href="/admin">관리자 페이지</Link>
        </Button>
      </div>

      <footer className="mt-20 text-[10px] text-muted-foreground uppercase tracking-widest">
        OiOiBawige / Cheer Rock Crab
      </footer>
    </div>
  );
}
