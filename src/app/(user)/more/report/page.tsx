"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useState } from "react";

import { MoreBackButton, MoreHeader } from "@/shared/components/more/MoreCommon";

/**
 * [RENEWAL] 오류 제보 페이지 (디자인 토큰 정화)
 * Iframe 로딩 상태 제어를 위해 "use client" 유지
 */
export default function ReportPage() {
  const [isLoading, setIsLoading] = useState(true);

  // 실제 구글 폼 주소
  const GOOGLE_FORM_URL =
    "https://docs.google.com/forms/d/e/1FAIpQLSdu_sIk6G7OQOKV_NwkmCbtVCfSqupewtf7qi_kRGFTmIB-gw/viewform?usp=dialog";

  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      <MoreBackButton />

      <MoreHeader title="오류 제보" subTitle="Feedback" className="mt-12" />

      {/* 구글 폼 임베드 영역 */}
      <div className="border-border bg-card relative min-h-[600px] w-full overflow-hidden rounded-3xl border shadow-2xl backdrop-blur-xl">
        {/* 로딩 상태 표시 */}
        {isLoading && (
          <div className="bg-background/80 absolute inset-0 z-10 flex flex-col items-center justify-center gap-4">
            <RefreshCw className="text-muted-foreground/30 animate-spin" size={32} />
            <span className="text-muted-foreground/40 animate-pulse text-sm font-black tracking-widest uppercase">
              Loading Form...
            </span>
          </div>
        )}

        {/* Iframe 컨텐츠 */}
        <iframe
          src={GOOGLE_FORM_URL}
          className="h-[800px] w-full border-none lg:h-[900px]"
          title="Feedback Form"
          onLoad={() => setIsLoading(false)}
        />

        {/* 폼 하단 보조 텍스트 (모바일용) */}
        <div className="mt-4 flex items-center justify-center gap-4 pb-12">
          <a
            href={GOOGLE_FORM_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground text-muted-foreground flex items-center gap-2 text-xs font-bold transition-all"
          >
            새 창에서 열기
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
