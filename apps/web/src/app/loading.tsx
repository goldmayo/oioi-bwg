/**
 * 전역 로딩 페이지 (OiOiBawige 스타일)
 */
export default function GlobalLoading() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center p-4">
      <div className="relative h-16 w-16">
        {/* 외부 링 */}
        <div className="border-muted absolute inset-0 rounded-full border-4" />
        {/* 회전하는 브랜드 컬러 링 */}
        <div className="border-qwer-w absolute inset-0 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-foreground animate-pulse text-sm font-bold tracking-widest uppercase">
          Loading...
        </p>
        <p className="text-muted-foreground text-[10px] tracking-[0.2em] uppercase">OiOiBawige</p>
      </div>
    </div>
  );
}
