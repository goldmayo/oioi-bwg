import { BentoGridContainer } from "@/components/home/BentoGridContainer";
import { prisma } from "@/libs/prisma";
import { Album, ALBUMS } from "@/types/album";

/**
 * 사용자 메인 페이지: "Harmony Mosaic" 리뉴얼
 * 통합된 ALBUMS 상수를 사용하여 앨범 정보를 렌더링합니다.
 */
export default async function UserMainPage() {
  const songs = await prisma.song.findMany({
    orderBy: { order: "asc" },
  });

  // 앨범별 곡 그룹화 (통합 ALBUMS 상수 기반)
  const albumsData = ALBUMS.map((album) => {
    // DB에서 해당 앨범에 속한 곡들만 필터링
    const albumSongs = songs
      .filter((s) => s.albumName === album.name)
      .map((s) => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        hasOfficialCheer: s.hasOfficialCheer,
      }));

    if (albumSongs.length === 0) return null;

    return {
      ...album,
      songs: albumSongs,
    };
  }).filter(Boolean);

  return (
    <div className="container mx-auto min-h-screen px-4 py-12 lg:py-20">
      <header className="mb-12 text-center">
        <h1 className="text-foreground text-4xl font-black tracking-tighter lg:text-6xl">
          어이어이<span className="text-qwer-w">바위게</span>
        </h1>
        <p className="text-muted-foreground mt-4 text-xs font-bold tracking-[0.3em] uppercase">
          바위게야 오늘은 응원을 배우자
        </p>
      </header>

      {/* 인터랙티브 벤토 그리드 (통합 데이터 사용) */}
      <BentoGridContainer albums={albumsData as unknown as Album[]} />

      <footer className="border-border/50 mt-20 border-t py-12 text-center">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.3em] uppercase">
          OiOiBawige / Cheer Rock Crab - 2026
        </p>
      </footer>
    </div>
  );
}
