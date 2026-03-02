/**
 * 전역 로딩 페이지 (OiOiBawige 스타일)
 */
export default function GlobalLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <div className="relative h-16 w-16">
        {/* 외부 링 */}
        <div className="absolute inset-0 rounded-full border-4 border-muted" />
        {/* 회전하는 브랜드 컬러 링 */}
        <div className="absolute inset-0 rounded-full border-4 border-qwer-w border-t-transparent animate-spin" />
      </div>
      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-sm font-bold tracking-widest text-foreground uppercase animate-pulse">
          Loading...
        </p>
        <p className="text-[10px] text-muted-foreground uppercase tracking-[0.2em]">
          OiOiBawige
        </p>
      </div>
    </div>
  );
}
