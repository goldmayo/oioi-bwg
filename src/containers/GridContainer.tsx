"use client";

import gsap from "gsap";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { AlbumCard } from "@/shared/components/album/AlbumCard";
import { Album } from "@/shared/types/album";

interface GridContainerProps {
  albums: Album[];
}

/**
 * 앨범 정사각 그리드 컨테이너
 * URL 변화(Intercepting Routes)를 감지하여 배경 애니메이션을 자동으로 처리합니다.
 */
export function GridContainer({ albums }: GridContainerProps) {
  const pathname = usePathname();
  const gridRef = useRef<HTMLDivElement>(null);

  // 현재 앨범 모달이 열려있는지 여부
  const isModalOpen = pathname.includes("/albums/");

  /**
   * 주소창의 변화에 따라 배경 그리드의 블러 및 스케일을 제어합니다.
   */
  useEffect(() => {
    if (!gridRef.current) return;

    if (isModalOpen) {
      // 모달 오픈 시: 배경 블러 및 살짝 축소
      gsap.to(gridRef.current, {
        opacity: 0.3,
        scale: 0.99,
        duration: 0.2,
        ease: "power2.out",
      });
    } else {
      // 메인 복귀 시: 원래 상태로 복구
      gsap.to(gridRef.current, {
        opacity: 1,
        scale: 1,
        duration: 0.2,
        ease: "power2.inOut",
      });
    }
  }, [isModalOpen]);

  return (
    <div className="relative w-full px-4 py-10">
      {/* 앨범 그리드 영역 */}
      <div
        ref={gridRef}
        className="xs:grid-cols-2 mx-auto grid max-w-6xl origin-center grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      >
        {albums.map((album) => (
          <AlbumCard key={album.name} album={album} />
        ))}
      </div>
    </div>
  );
}
