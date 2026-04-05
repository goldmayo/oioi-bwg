"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { AlbumCard } from "@/shared/components/album/AlbumCard";
import { AlbumListItem } from "@/shared/components/album/AlbumListItem";
import { Album } from "@/shared/types/album";

interface AlbumListContainerProps {
  albums: Album[];
}

/**
 * [HOME RENEWAL] 하이브리드 디스코그래피 컨테이너
 * 모바일(List)과 데스크탑(Grid)의 장점을 결합한 지능형 전용 컨테이너입니다.
 */
export function AlbumListContainer({ albums }: AlbumListContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  /**
   * 컴포넌트 마운트 시 통합 애니메이션 (Stagger)
   */
  useEffect(() => {
    if (!containerRef.current) return;

    // 모바일 리스트 아이템과 데스크탑 그리드 카드를 모두 타겟팅
    const items = containerRef.current.querySelectorAll(".album-item-wrapper");
    gsap.fromTo(
      items,
      { opacity: 0, y: 30, filter: "blur(10px)" },
      {
        opacity: 1,
        y: 0,
        filter: "blur(0px)",
        stagger: 0.05,
        duration: 1,
        ease: "power4.out",
      },
    );
  }, []);

  return (
    <div ref={containerRef} className="relative w-full">
      {/* 
        1. [Mobile 전용] 세로 리스트 뷰 
        - md 브레이크포인트 미만에서만 노출
      */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {albums.map((album) => (
          <div key={`${album.name}-list`} className="album-item-wrapper opacity-0">
            <AlbumListItem album={album} />
          </div>
        ))}
      </div>

      {/* 
        2. [Desktop 전용] 정사각 그리드 뷰 
        - md 브레이크포인트 이상에서만 노출
        - 리뉴얼 톤에 맞춰 더 넓은 간격(gap-10)과 넉넉한 레이아웃 제공
      */}
      <div className="xs:grid-cols-2 mx-auto hidden max-w-7xl origin-center grid-cols-2 gap-8 md:grid lg:grid-cols-3 xl:grid-cols-4">
        {albums.map((album) => (
          <AlbumCard key={`${album.name}-grid`} album={album} />
        ))}
      </div>
    </div>
  );
}
