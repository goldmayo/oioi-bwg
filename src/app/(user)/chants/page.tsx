import { Suspense } from "react";

import { getAllAlbumsWithSongs } from "@/shared/api/db/drizzle/queries";
import { AlbumListSkeleton } from "@/shared/components/album/AlbumListSkeleton";
import { FilteredChantList } from "@/shared/components/chant/FilteredChantList";

/**
 * [RENEWAL] 서버 사이드 데이터 페칭 및 렌더링
 */
async function ChantsDataWrapper() {
  const dbAlbums = await getAllAlbumsWithSongs();

  // 인터페이스 매핑 및 평탄화
  const allSongs = dbAlbums.flatMap((album) =>
    album.songs.map((s) => ({
      title: s.title,
      slug: s.slug,
      hasOfficial: s.hasOfficialCheer,
      albumName: album.name,
      albumCover: album.imgUrl,
      youtubeId: s.youtubeId, // Type consistency
    })),
  );

  return <FilteredChantList initialSongs={allSongs} />;
}

export default function ChantsPage() {
  return (
    <div className="container mx-auto min-h-screen px-4 pt-12 pb-32 lg:pt-24 lg:pb-40">
      {/* 헤더 */}
      <header className="mb-12 px-2">
        <div className="mb-3 flex items-center gap-3">
          <h1 className="text-2xs text-muted-foreground font-black tracking-[0.4rem] uppercase">
            Chants & Cheer
          </h1>
        </div>
        <h2 className="text-foreground text-4xl font-black tracking-tighter lg:text-5xl">
          응원법 리스트
        </h2>
      </header>

      <Suspense fallback={<AlbumListSkeleton />}>
        <ChantsDataWrapper />
      </Suspense>
    </div>
  );
}
