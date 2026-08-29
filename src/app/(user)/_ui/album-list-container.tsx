"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";

import { Album, AlbumCard, AlbumListItem } from "@/entities/album";

interface AlbumListContainerProps {
  albums: Album[];
}

/**
 * 사용자 홈 전용 앨범 목록 컨테이너.
 * 모바일 리스트와 데스크톱 그리드를 함께 렌더링한다.
 */
export function AlbumListContainer({ albums }: AlbumListContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const items = containerRef.current.querySelectorAll(".album-item-wrapper");
    gsap.fromTo(
      items,
      { opacity: 0, y: 30, filter: "blur(2px)" },
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
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {albums.map((album) => (
          <div key={`${album.name}-list`} className="album-item-wrapper opacity-0">
            <AlbumListItem album={album} />
          </div>
        ))}
      </div>

      <div className="xs:grid-cols-2 mx-auto hidden max-w-7xl origin-center grid-cols-2 gap-8 md:grid lg:grid-cols-3 xl:grid-cols-4">
        {albums.map((album) => (
          <AlbumCard key={`${album.name}-grid`} album={album} />
        ))}
      </div>
    </div>
  );
}
