import { cache } from "react";
import { notFound } from "next/navigation";

import { LyricsViewerClient } from "@/features/chant-sync";

import { toAlbumViewModel } from "@/entities/album";

import { getSongDetailBySlug } from "@/server/services/song-service";

import { constructMetadata } from "@/shared/lib/metadata";

export const dynamic = "force-dynamic";

const getSongDetail = cache(getSongDetailBySlug);

interface SongPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 동적 메타데이터 생성
 */
export async function generateMetadata({ params }: SongPageProps) {
  const { slug } = await params;
  const song = await getSongDetail(slug);

  if (!song || !song.album) return {};

  return constructMetadata({
    title: song.title,
    description: `${song.album.name} 수록곡 '${song.title}'의 비공식 응원법 가이드입니다.`,
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

  const song = await getSongDetail(slug);

  if (!song) {
    return notFound();
  }

  return (
    <main className="bg-background flex flex-col">
      <LyricsViewerClient
        song={{
          id: song.id,
          title: song.title,
          youtubeId: song.youtubeId,
          lyrics: song.lyrics,
          hasOfficialCheer: song.hasOfficialCheer,
        }}
        album={toAlbumViewModel(song.album)}
      />
    </main>
  );
}
