"use client";

import { useRouter } from "next/navigation";
import { use } from "react";

import { AlbumDetailModal } from "@/components/home/AlbumDetailModal";
import { ALBUMS } from "@/types/album";

/**
 * 일반 라우트: /albums/[slug]로 직접 접속 시 보여줄 전체 화면 페이지
 */
export default function AlbumFullPage({ 
  params 
}: { 
  params: Promise<{ slug: string }> 
}) {
  const router = useRouter();
  const { slug } = use(params);

  const album = ALBUMS.find((a) => a.imageSlug === slug);

  if (!album) return (
    <div className="flex items-center justify-center h-full text-muted-foreground font-bold">
      Album not found.
    </div>
  );

  /**
   * 직접 접속한 페이지에서 닫기를 누르면 메인으로 이동
   */
  const handleClose = () => {
    router.push("/");
  };

  return (
    <div className="h-full bg-background pt-10">
      <AlbumDetailModal 
        album={album} 
        onClose={handleClose} 
      />
    </div>
  );
}
