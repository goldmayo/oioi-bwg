import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/libs/prisma";

// 앨범 순서 정의
const ALBUM_ORDER = [
  "1st Single Album: Harmony from Discord",
  "1st Mini Album: MANITO",
  "2nd Mini Album: Algorithm's Blossom",
  "3rd Mini Album: In a million noises, I'll be your harmony",
  "Digital Single: Youth Promise",
  "Singles",
];

// 앨범별 컬러 매핑 (디자인 시스템 변수 활용)
const ALBUM_COLORS: Record<string, string> = {
  "1st Single Album: Harmony from Discord": "var(--album-single1)",
  "1st Mini Album: MANITO": "var(--album-ep1-primary)",
  "2nd Mini Album: Algorithm's Blossom": "var(--album-ep2-primary)",
  "3rd Mini Album: In a million noises, I'll be your harmony": "var(--album-ep3-primary)",
  "Digital Single: Youth Promise": "var(--qwer-r)",
  Singles: "var(--qwer-e)",
};

/**
 * 사용자 메인 페이지: 앨범별 곡 리스트
 */
export default async function UserMainPage() {
  const songs = await prisma.song.findMany({
    orderBy: { order: "asc" },
  });

  // 앨범별 곡 그룹화
  const albums = songs.reduce(
    (acc, song) => {
      if (!acc[song.albumName]) {
        acc[song.albumName] = [];
      }
      acc[song.albumName].push(song);
      return acc;
    },
    {} as Record<string, typeof songs>,
  );

  // 정의된 순서대로 앨범 정렬
  const sortedAlbumNames = Object.keys(albums).sort((a, b) => {
    const indexA = ALBUM_ORDER.indexOf(a);
    const indexB = ALBUM_ORDER.indexOf(b);
    if (indexA === -1 && indexB === -1) return a.localeCompare(b);
    if (indexA === -1) return 1;
    if (indexB === -1) return -1;
    return indexA - indexB;
  });

  return (
    <div className="container mx-auto min-h-screen px-4 py-12 lg:py-20">
      {/* 서비스 헤더 */}
      <header className="mb-16 text-center lg:mb-24">
        <h1 className="text-foreground text-4xl font-black tracking-tighter lg:text-6xl">
          어이어이<span className="text-qwer-w">바위게</span>
        </h1>
        <p className="text-muted-foreground mt-4 text-sm font-medium tracking-widest uppercase lg:text-base">
          &quot;바위게야 오늘은 응원법을 알아보자&quot;
        </p>
        <div className="bg-qwer-r mx-auto mt-6 h-1 w-12 rounded-full" />
      </header>

      {/* 앨범 섹션 리스트 */}
      <div className="space-y-20 lg:space-y-32">
        {sortedAlbumNames.map((albumName) => (
          <section key={albumName}>
            <div className="mb-8 flex items-center gap-4">
              <div
                className="h-8 w-1.5 rounded-full"
                style={{ backgroundColor: ALBUM_COLORS[albumName] || "var(--primary)" }}
              />
              <h2 className="text-foreground text-xl font-black tracking-tight lg:text-2xl">
                {albumName}
              </h2>
              <Badge
                variant="outline"
                className="border-border/50 text-muted-foreground ml-2 text-[10px] font-bold"
              >
                {albums[albumName].length} SONGS
              </Badge>
            </div>

            {/* 곡 그리드 리스트 */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {albums[albumName].map((song) => (
                <Link key={song.id} href={`/songs/${song.slug}`} className="group">
                  <Card className="border-border/50 bg-card hover:border-border group-hover:ring-qwer-w/20 h-full transition-all duration-300 group-hover:ring-1 hover:-translate-y-1 hover:shadow-xl">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-foreground group-hover:text-qwer-w line-clamp-1 text-lg font-bold tracking-tight transition-colors">
                          {song.title}
                        </CardTitle>
                        {song.hasOfficialCheer && (
                          <Badge className="bg-qwer-r/10 text-qwer-r hover:bg-qwer-r/20 text-[10px] font-black">
                            OFFICIAL
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground text-xs font-medium tracking-widest uppercase">
                        Click to learn cheers
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>

      <footer className="border-border/50 mt-32 border-t py-12 text-center">
        <p className="text-muted-foreground text-[10px] font-bold tracking-[0.3em] uppercase">
          OiOiBawige / Cheer Rock Crab - 2026
        </p>
      </footer>
    </div>
  );
}
