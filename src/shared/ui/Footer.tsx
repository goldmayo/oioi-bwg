/**
 * 전역 푸터 컴포넌트
 * 프로젝트의 비영리 성격과 면책 문구를 명시합니다.
 */
export function Footer() {
  return (
    <footer className="max-h-50 border-t border-white/5 px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6 text-center">
        {/* 브랜드 & 링크 섹션 */}
        <div className="space-y-4">
          <h2 className="text-muted-foreground text-xs font-bold tracking-[0.4em] uppercase md:text-sm">
            OIOIBAWIGE <span className="ml-2 font-medium">©2026</span>
          </h2>

          {/* 깃허브 & 오픈카톡 (아이콘 스타일 추천) */}
          {/* <div className="text-muted-foreground flex justify-center gap-6">
            <Link
              href="https://github.com/goldmayo/oioi-bwg"
              className="hover:text-primary flex items-center gap-1.5 text-xs transition-colors"
            >
              <GithubIcon className="h-4 w-4" />
              GitHub
            </Link>
            <Link
              href="#"
              className="hover:text-primary flex items-center gap-1.5 text-xs transition-colors"
            >
              <KaKaoTalkIcon className="h-4 w-4" />
              제보하기
            </Link>
          </div> */}
        </div>

        {/* 설명 섹션 */}
        <div className="text-muted-foreground/60 space-y-2 text-[11px] leading-relaxed md:text-xs">
          <p className="text-muted-foreground/40 font-medium tracking-wide uppercase">
            Fan-made Non-profit Project
          </p>
          <p className="mx-auto max-w-sm break-keep">
            개인적인 응원 경험을 바탕으로 정리하여 공식 응원법과 차이가 있을 수 있습니다. 더 나은
            응원을 위한 제보와 피드백은 언제나 환영합니다!
          </p>
        </div>
      </div>
    </footer>
  );
}
