"use cache";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AlbumDetailModal } from "@/features/album-info/AlbumDetailModal";
import { AlbumDetailSkeleton } from "@/features/album-info/AlbumDetailSkeleton";
import { getAlbumBySlug } from "@/shared/api/db/drizzle/queries";
import { Album } from "@/shared/types/album";
import { constructMetadata } from "@/shared/utils/metadata";

interface AlbumPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 동적 메타데이터 생성
 */
export async function generateMetadata({ params }: AlbumPageProps) {
  const { slug } = await params;
  const album = await getAlbumBySlug(slug);

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

  // 앨범 데이터 조회를 위한 프로미스 생성
  const albumPromise = getAlbumBySlug(slug);

  return (
    <main className="bg-background flex flex-col px-4 pt-10 md:px-10">
      <Suspense fallback={<AlbumPageLoader />}>
        <AlbumDetailLoader promise={albumPromise} />
      </Suspense>
    </main>
  );
}

/**
 * 데이터를 실제로 해소하여 클라이언트 모달 컴포넌트로 넘겨주는 중간 컴포넌트
 */
async function AlbumDetailLoader({ promise }: { promise: ReturnType<typeof getAlbumBySlug> }) {
  const dbAlbum = await promise;

  if (!dbAlbum) {
    return notFound();
  }

  // 프론트의 Album 타입 스펙에 맞춰 매핑
  const albumData: Album = {
    name: dbAlbum.name,
    imageSlug: dbAlbum.slug,
    imgUrl: dbAlbum.imgUrl,
    color: dbAlbum.color,
    songs: dbAlbum.songs.map((s) => ({
      title: s.title,
      slug: s.slug,
      file: "",
      youtubeId: s.youtubeId || "",
      hasOfficial: s.hasOfficialCheer,
    })),
  };

  return <AlbumDetailModal album={albumData} />;
}

/**
 * 앨범 상세 페이지 전용 로딩 스켈레톤
 */
function AlbumPageLoader() {
  return (
    <div className="mx-auto flex h-[85vh] w-full max-w-5xl animate-pulse items-center justify-center">
      <AlbumDetailSkeleton />
    </div>
  );
}
