export function DashboardSkeleton({ variant }: { variant: "summary" | "chart" | "rows" }) {
  return (
    <div aria-hidden="true" className="min-w-0 space-y-3 motion-safe:animate-pulse">
      {variant === "summary" && (
        <div className="grid grid-cols-3 gap-3">
          {[0, 1, 2].map((item) => (
            <div key={item} className="space-y-2">
              <div className="bg-muted h-3 w-3/4 rounded-sm" />
              <div className="bg-muted h-7 w-1/2 rounded-sm" />
            </div>
          ))}
        </div>
      )}
      {variant === "chart" && (
        <div className="border-border flex h-48 items-end gap-3 border-b border-l px-4 sm:h-60">
          {[28, 44, 38, 62, 53, 73, 60, 82].map((height) => (
            <div
              key={height}
              className="bg-muted flex-1 rounded-t-sm"
              style={{ height: height + "%" }}
            />
          ))}
        </div>
      )}
      {variant === "rows" &&
        [76, 59, 68, 47, 34].map((width) => (
          <div key={width} className="border-border flex h-7 items-center gap-3 border-b">
            <div className="bg-muted h-3 w-20 shrink-0 rounded-sm" />
            <div className="bg-muted h-2 rounded-sm" style={{ width: width + "%" }} />
          </div>
        ))}
    </div>
  );
}
