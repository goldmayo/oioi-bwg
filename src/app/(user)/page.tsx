import { Suspense } from "react";

import { GridContainer } from "@/containers/GridContainer";
import { getAllAlbumsWithSongs } from "@/shared/api/db/drizzle/queries";
import { Album } from "@/shared/types/album";

// ----------------------------------------------------------------------
// 1. 데이터 페칭 컴포넌트 (Async 래퍼)
// ----------------------------------------------------------------------
async function AsyncAlbumsGrid() {
  const dbAlbums = await getAllAlbumsWithSongs();

  // 프론트 컴포넌트(GridContainer) 호환성을 위한 데이터매핑
  const albumsData = dbAlbums
    .map((album) => ({
      name: album.name,
      imageSlug: album.slug,
      imgUrl: album.imgUrl,
      color: album.color,
      songs: album.songs,
    }))
    .filter((a) => a.songs.length > 0);

  return <GridContainer albums={albumsData as unknown as Album[]} />;
}

// ----------------------------------------------------------------------
// 2. 스켈레톤 UI 컴포넌트 (로딩 중 표시)
// ----------------------------------------------------------------------
function GridSkeleton() {
  return (
    <div className="relative w-full px-4 py-10">
      <div className="xs:grid-cols-2 mx-auto grid max-w-6xl origin-center grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-card border-border/50 relative aspect-square overflow-hidden rounded-2xl border"
          >
            <div className="relative h-full w-full">
              {/* 스켈레톤 백그라운드 이미지 영역 */}
              <div className="bg-muted/20 absolute inset-0 animate-pulse" />

              {/* 앨범 커버의 어두운 그라데이션 똑같이 유지 */}
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-60" />

              {/* 텍스트 스켈레톤 영역 */}
              <div className="absolute right-8 bottom-10 left-8 flex flex-col gap-3">
                {/* 제목 스켈레톤 */}
                <div className="h-6 w-2/3 animate-pulse rounded-md bg-white/20" />

                {/* 서브 텍스트(트랙 수) 스켈레톤 */}
                <div className="mt-2 flex items-center gap-2">
                  <div className="h-1 w-6 animate-pulse rounded-full bg-white/20" />
                  <div className="h-3 w-16 animate-pulse rounded-sm bg-white/20" />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 3. 메인 페이지 레이아웃 (데이터 페칭을 기다리지 않고 즉각 라우팅 지원)
// ----------------------------------------------------------------------
export default function UserMainPage() {
  return (
    <div className="container mx-auto min-h-screen px-4 py-12 lg:py-20">
      <header className="mb-8 text-center md:mb-12">
        <h1 className="text-foreground text-4xl font-black tracking-tighter lg:text-6xl">
          <span className="text-qwer-q">어</span>
          <span className="text-qwer-w">이</span>
          <span className="text-qwer-e">어</span>
          <span className="text-qwer-r">이</span>
          <span className="text-white">바위게</span>
        </h1>
        <p className="text-muted-foreground mt-4 text-xs font-bold tracking-[0.3em] uppercase md:text-base">
          바위게야 오늘은 응원을 하자
        </p>
        <div className="mt-8 flex justify-center">
          <div className="max-w-xl">
            <p className="text-muted-foreground/80 text-center text-sm leading-relaxed break-keep md:text-base">
              같이 응원하면 더 즐거운 응원법을 공유합니다.
            </p>
            <p className="text-muted-foreground/80 text-center text-sm leading-relaxed break-keep md:text-base">
              공식 응원법과는 다를 수 있습니다.
            </p>
          </div>
        </div>
      </header>

      <Suspense fallback={<GridSkeleton />}>
        <AsyncAlbumsGrid />
      </Suspense>
    </div>
  );
}
