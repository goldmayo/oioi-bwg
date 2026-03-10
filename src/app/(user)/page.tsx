import { GridContainer } from "@/components/home/GridContainer";
import { getAllSongs } from "@/libs/db/drizzle/queries"; // 쿼리 헬퍼 사용
import { Album, ALBUMS } from "@/types/album";

/**
 * 사용자 메인 페이지: "Harmony Mosaic" 리뉴얼
 * 데이터 접근 계층(Queries)을 활용하여 앨범 정보를 렌더링합니다.
 */
export default async function UserMainPage() {
  // 직접 db 호출 대신 캡슐화된 쿼리 함수 사용
  const songs = await getAllSongs();

  // 앨범별 곡 그룹화 로직
  const albumsData = ALBUMS.map((album) => {
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
              함께 응원하며 즐거웠던 순간의 포인트들을 모았습니다. 공식 응원법과는 조금 다를 수
              있지만, 현장에서 다 같이 호흡했던 기억을 바탕으로 공유합니다. 공연을 더 신나게 즐기기
              위한 작은 보탬이 되길 바랍니다.
            </p>
          </div>
        </div>
      </header>

      <GridContainer albums={albumsData as unknown as Album[]} />
    </div>
  );
}
