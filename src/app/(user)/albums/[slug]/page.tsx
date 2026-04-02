"use cache";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AlbumDetailModal } from "@/features/album-info/AlbumDetailModal";
import { AlbumDetailSkeleton } from "@/features/album-info/AlbumDetailSkeleton";
import { Album, ALBUMS } from "@/shared/types/album";
import { constructMetadata } from "@/shared/utils/metadata";

interface AlbumPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * 동적 메타데이터 생성
 */
export async function generateMetadata({ params }: AlbumPageProps) {
  const { slug } = await params;
  const album = ALBUMS.find((a) => a.imageSlug === slug);

  if (!album) return {};

  return constructMetadata({
    title: album.name,
    description: `${album.name} 앨범의 수록곡 리스트와 응원법 정보를 확인하세요.`,
    image: `/images/albums/${album.imageSlug}.webp`,
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

  // 앨범 데이터 조회를 위한 프로미스 생성 (현재는 정적 데이터이므로 즉시 해소)
  const albumPromise = Promise.resolve(ALBUMS.find((a) => a.imageSlug === slug));

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
async function AlbumDetailLoader({ promise }: { promise: Promise<Album | undefined> }) {
  const album = await promise;

  if (!album) {
    return notFound();
  }

  return <AlbumDetailModal album={album} />;
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
