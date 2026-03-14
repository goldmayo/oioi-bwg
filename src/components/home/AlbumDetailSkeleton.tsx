/**
 * 앨범 상세 정보 로딩 시 보여줄 스켈레톤 UI (공통)
 */
export function AlbumDetailSkeleton() {
  return (
    <div className="bg-card border-border relative flex h-full w-full flex-col overflow-hidden rounded-2xl border shadow-2xl md:flex-row">
      {/* 앨범 커버 영역 스켈레톤 */}
      <div className="bg-muted w-full shrink-0 md:h-full md:w-[45%]" />

      {/* 수록곡 리스트 영역 스켈레톤 */}
      <div className="flex flex-1 flex-col space-y-8 p-8 md:p-16">
        <div className="bg-muted h-10 w-3/4 rounded-full md:h-12" />
        <div className="bg-muted h-1.5 w-24 rounded-full" />

        <div className="mt-8 space-y-4">
          {[1, 2, 3, 4, 5].map((idx) => (
            <div key={idx} className="bg-muted h-14 w-full rounded-2xl md:h-16" />
          ))}
        </div>
      </div>
    </div>
  );
}
