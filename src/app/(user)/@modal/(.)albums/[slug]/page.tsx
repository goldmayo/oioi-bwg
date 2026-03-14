"use cache";

import { notFound } from "next/navigation";
import { Suspense } from "react";

import { AlbumDetailModal } from "@/components/home/AlbumDetailModal";
import { AlbumDetailSkeleton } from "@/components/home/AlbumDetailSkeleton";
import { Album, ALBUMS } from "@/types/album";

interface InterceptedAlbumProps {
  params: Promise<{ slug: string }>;
}

/**
 * 인터셉팅 라우트: 메인 페이지에서 /albums/[slug]로 이동 시 가로채서 모달을 띄웁니다.
 */
export default async function InterceptedAlbumPage({ params }: InterceptedAlbumProps) {
  const { slug } = await params;

  if (!slug) return null;

  // 앨범 데이터 조회를 위한 프로미스 생성
  const albumPromise = Promise.resolve(ALBUMS.find((a) => a.imageSlug === slug));

  return (
    <Suspense fallback={<AlbumModalLoader />}>
      <AlbumDetailLoader promise={albumPromise} />
    </Suspense>
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
 * 인터셉팅 모달 전용 로딩 스켈레톤
 */
function AlbumModalLoader() {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-10">
      {/* Backdrop 스켈레톤 */}
      <div className="bg-background/40 absolute inset-0 backdrop-blur-sm" />

      {/* Shared Modal Skeleton */}
      <div className="relative flex h-full max-h-[85vh] w-full max-w-5xl animate-pulse items-center justify-center">
        <AlbumDetailSkeleton />
      </div>
    </div>
  );
}
