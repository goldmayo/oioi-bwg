import { notFound } from "next/navigation";
import { Suspense } from "react";

import { LyricsViewerClient } from "@/components/lyrics/LyricsViewerClient";
import { getSongBySlug } from "@/libs/db/drizzle/queries";
import { Song } from "@/libs/db/drizzle/schema";
import { ALBUMS } from "@/types/album";
import { LyricLine } from "@/types/lyrics";
import { constructMetadata } from "@/utils/metadata";

interface SongPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 동적 메타데이터 생성
 */
export async function generateMetadata({ params }: SongPageProps) {
  const { slug } = await params;
  const song = await getSongBySlug(slug);

  if (!song) return {};

  const album = ALBUMS.find((a) => a.name === song.albumName);

  return constructMetadata({
    title: song.title,
    description: `${song.albumName} 수록곡 '${song.title}'의 응원법 가이드입니다.`,
    image: album ? `/images/albums/${album.imageSlug}.webp` : undefined,
  });
}

/**
 * 사용자용 곡 상세 페이지 (Server Component)
 * 이제 ID가 아닌 고유 Slug를 기반으로 곡을 조회합니다.
 */
export default async function SongDetailPage({ params }: SongPageProps) {
  const { slug } = await params;

  if (!slug) {
    return notFound();
  }

  const songPromise = getSongBySlug(slug);

  return (
    <main className="bg-background flex flex-col">
      <Suspense fallback={<SongPageLoader />}>
        <LyricsViewerLoader promise={songPromise} />
      </Suspense>
    </main>
  );
}

/**
 * 데이터를 실제로 해소하여 클라이언트 뷰어에게 넘겨주는 중간 컴포넌트
 */
async function LyricsViewerLoader({ promise }: { promise: Promise<Song | undefined> }) {
  const song = await promise;

  if (!song) {
    return notFound();
  }

  // 앨범 정보 찾기 (song.albumName과 일치하는 앨범 검색)
  const album = ALBUMS.find((a) => a.name === song.albumName);

  // JsonValue 타입을 LyricLine[] 타입으로 안전하게 캐스팅하여 포맷팅
  const formattedSong = {
    ...song,
    lyrics: (song.lyrics as unknown as LyricLine[]) || [],
  };

  return <LyricsViewerClient song={formattedSong} album={album} />;
}

/**
 * 곡 상세 페이지 전용 로딩 스켈레톤
 */
function SongPageLoader() {
  return (
    <div className="flex h-screen animate-pulse flex-col lg:flex-row">
      {/* 플레이어 영역 스켈레톤 */}
      <div className="bg-muted border-border h-[40vh] w-full border-b lg:h-full lg:w-[40%] lg:border-r lg:border-b-0" />
      {/* 가사 영역 스켈레톤 */}
      <div className="mx-auto w-full max-w-3xl flex-1 space-y-12 p-12">
        <div className="bg-muted h-10 w-3/4 rounded" />
        <div className="bg-muted h-10 w-1/2 rounded" />
        <div className="bg-muted h-10 w-2/3 rounded" />
        <div className="bg-muted h-10 w-3/4 rounded" />
      </div>
    </div>
  );
}
