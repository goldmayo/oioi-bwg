/**
 * [HOME RENEWAL] 하이브리드 리스트/그리드 스켈레톤 UI
 * 모바일(List)과 데스크탑(Grid) 레이아웃에 맞춰 로딩 화면도 반응형으로 제공합니다.
 */
export function AlbumListSkeleton() {
  return (
    <div className="relative w-full">
      {/* 1. [Mobile 전용] 세로 리스트 스켈레톤 (md 미만 노출) */}
      <div className="flex flex-col gap-3 md:hidden">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`list-skeleton-${i}`}
            className="bg-card/40 border-border/30 flex h-24 w-full animate-pulse items-center gap-4 rounded-xl border px-2"
          >
            {/* 썸네일 스켈레톤 */}
            <div className="bg-muted/20 ml-1 h-16 w-16 shrink-0 rounded-lg" />

            {/* 텍스트 스켈레톤 */}
            <div className="flex flex-1 flex-col gap-2 pr-4">
              <div className="bg-muted/30 h-5 w-2/3 rounded-md" />
              <div className="bg-muted/20 h-3 w-1/4 rounded-sm" />
            </div>
          </div>
        ))}
      </div>

      {/* 2. [Desktop 전용] 정사각 그리드 스켈레톤 (md 이상 노출) */}
      <div className="mx-auto hidden max-w-7xl grid-cols-2 gap-10 md:grid lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={`grid-skeleton-${i}`}
            className="bg-card/40 border-border/30 relative aspect-square w-full animate-pulse overflow-hidden rounded-2xl border"
          >
            {/* 텍스트 스켈레톤 영역 (하단 고정) */}
            <div className="absolute right-8 bottom-10 left-8 flex flex-col gap-3">
              <div className="h-6 w-2/3 rounded-md bg-white/20" />
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 w-6 rounded-full bg-white/20" />
                <div className="h-3 w-16 rounded-sm bg-white/20" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
