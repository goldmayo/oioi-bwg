import { Suspense } from "react";

import { AlbumListSkeleton, toAlbumViewModel } from "@/entities/album";

import { listVisibleAlbumsWithSongs } from "@/server/services/album-service";

import { AlbumListContainer } from "./_ui/album-list-container";

export const dynamic = "force-dynamic";

// ----------------------------------------------------------------------
// 1. 데이터 페칭 컴포넌트 (Async 래퍼)
// ----------------------------------------------------------------------
async function AsyncAlbumsList() {
  const dbAlbums = await listVisibleAlbumsWithSongs();

  // 프론트 컴포넌트(AlbumListContainer) 뷰모델 매핑
  const albumsData = dbAlbums.map(toAlbumViewModel).filter((album) => album.songs.length > 0);

  return <AlbumListContainer albums={albumsData} />;
}

// ----------------------------------------------------------------------
// 2. 메인 페이지 레이아웃
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

      <Suspense fallback={<AlbumListSkeleton />}>
        <AsyncAlbumsList />
      </Suspense>
    </div>
  );
}
