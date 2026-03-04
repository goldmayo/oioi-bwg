"use client";

import { useRouter } from "next/navigation";
import { use } from "react";

import { AlbumDetailModal } from "@/components/home/AlbumDetailModal";
import { ALBUMS } from "@/types/album";

/**
 * 인터셉팅 라우트: 메인 페이지에서 /albums/[slug]로 이동 시 가로채서 모달을 띄웁니다.
 */
export default function InterceptedAlbumPage({ params }: { params: Promise<{ slug: string }> }) {
  const router = useRouter();
  const { slug } = use(params);

  // 통합 상수에서 해당 슬러그의 앨범 찾기
  const album = ALBUMS.find((a) => a.imageSlug === slug);

  if (!album) return null;

  /**
   * 모달 닫기: 단순히 상태를 바꾸는 게 아니라 히스토리를 뒤로 돌립니다.
   * 이렇게 하면 URL이 다시 메인(/)으로 돌아가며 모달이 닫힙니다.
   */
  const handleClose = () => {
    router.back();
  };

  return <AlbumDetailModal album={album} onClose={handleClose} />;
}
