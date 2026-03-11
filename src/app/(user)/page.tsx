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
              앵콘에서 같이 응원하면 더 즐거운 응원법을 바위게분들과 공유합니다.
            </p>
            <p className="text-muted-foreground/80 text-center text-sm leading-relaxed break-keep md:text-base">
              공식 응원법과는 다를 수 있습니다.
            </p>
          </div>
        </div>
      </header>

      <GridContainer albums={albumsData as unknown as Album[]} />
    </div>
  );
}
