import { cache } from "react";
import { notFound } from "next/navigation";

import { toAlbumViewModel } from "@/entities/album";

import { getAlbumDetailBySlug } from "@/server/services/album-service";

import { constructMetadata } from "@/shared/lib/metadata";

import { AlbumDetailModal } from "./_ui/album-detail-modal";

export const dynamic = "force-dynamic";

const getAlbumDetail = cache(getAlbumDetailBySlug);

interface AlbumPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 동적 메타데이터 생성
 */
export async function generateMetadata({ params }: AlbumPageProps) {
  const { slug } = await params;
  const album = await getAlbumDetail(slug);

  if (!album) return {};

  return constructMetadata({
    title: album.name,
    description: `${album.name} 앨범의 수록곡 리스트와 응원법 정보를 확인하세요.`,
    image: `/images/albums/${album.slug}.webp`,
  });
}

/**
 * 사용자용 앨범 상세 페이지 (Server Component)
 */
export default async function AlbumDetailPage({ params }: AlbumPageProps) {
  const { slug } = await params;

  if (!slug) {
    return notFound();
  }

  const album = await getAlbumDetail(slug);

  if (!album) {
    return notFound();
  }

  return (
    <main className="bg-background flex flex-col px-4 pt-10 md:px-10">
      <AlbumDetailModal album={toAlbumViewModel(album)} />
    </main>
  );
}
