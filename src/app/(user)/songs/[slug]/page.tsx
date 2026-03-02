import { notFound } from "next/navigation";
import { Suspense } from "react";

import { Song } from "@/app/generated/prisma/client";
import { LyricsViewerClient } from "@/components/lyrics/LyricsViewerClient";
import { prisma } from "@/libs/prisma";
import { LyricLine } from "@/types/lyrics";

interface SongPageProps {
  params: Promise<{ slug: string }>;
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

  // 1. 프로미스를 미리 생성합니다. (ID 대신 slug로 조회)
  const songPromise = prisma.song.findUnique({
    where: { slug },
  });

  return (
    <main className="flex min-h-screen flex-col bg-background">
      <Suspense fallback={<SongPageLoader />}>
        <LyricsViewerLoader promise={songPromise} />
      </Suspense>
    </main>
  );
}

/**
 * 데이터를 실제로 해소하여 클라이언트 뷰어에게 넘겨주는 중간 컴포넌트
 */
async function LyricsViewerLoader({ promise }: { promise: Promise<Song | null> }) {
  const song = await promise;

  if (!song) {
    return notFound();
  }

  // JsonValue 타입을 LyricLine[] 타입으로 안전하게 캐스팅하여 포맷팅
  const formattedSong = {
    ...song,
    lyrics: (song.lyrics as unknown as LyricLine[]) || [],
  };

  return <LyricsViewerClient song={formattedSong} />;
}

/**
 * 곡 상세 페이지 전용 로딩 스켈레톤
 */
function SongPageLoader() {
  return (
    <div className="flex h-screen flex-col animate-pulse lg:flex-row">
      {/* 플레이어 영역 스켈레톤 */}
      <div className="h-[40vh] w-full bg-muted border-b border-border lg:h-full lg:w-[40%] lg:border-b-0 lg:border-r" />
      {/* 가사 영역 스켈레톤 */}
      <div className="flex-1 space-y-12 p-12 mx-auto max-w-3xl w-full">
        <div className="h-10 bg-muted rounded w-3/4" />
        <div className="h-10 bg-muted rounded w-1/2" />
        <div className="h-10 bg-muted rounded w-2/3" />
        <div className="h-10 bg-muted rounded w-3/4" />
      </div>
    </div>
  );
}
