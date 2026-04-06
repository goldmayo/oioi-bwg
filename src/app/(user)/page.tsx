import { Suspense } from "react";

import { AlbumListContainer } from "@/containers/AlbumListContainer";
import { getAllAlbumsWithSongs } from "@/shared/api/db/drizzle/queries";
import { AlbumListSkeleton } from "@/shared/components/album/AlbumListSkeleton";
import { Album } from "@/shared/types/album";

// ----------------------------------------------------------------------
// 1. 데이터 페칭 컴포넌트 (Async 래퍼)
// ----------------------------------------------------------------------
async function AsyncAlbumsList() {
  const dbAlbums = await getAllAlbumsWithSongs();

  // 프론트 컴포넌트(AlbumListContainer) 뷰모델 매핑
  const albumsData = dbAlbums
    .map((album) => ({
      name: album.name,
      imageSlug: album.slug,
      imgUrl: album.imgUrl,
      color: album.color,
      songs: album.songs.map((s) => ({
        title: s.title,
        slug: s.slug,
        file: "", // Not strictly needed for basic rendering if missing
        youtubeId: s.youtubeId,
        hasOfficial: s.hasOfficialCheer,
        isTitle: s.isTitle,
      })),
    }))
    .filter((a) => a.songs.length > 0);

  return <AlbumListContainer albums={albumsData as unknown as Album[]} />;
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
