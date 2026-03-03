"use client";

import gsap from "gsap";
import { useEffect, useRef, useState } from "react";

import { Album } from "@/types/album";

import { AlbumDetailModal } from "./AlbumDetailModal";

interface BentoGridContainerProps {
  albums: Album[];
}

export function BentoGridContainer({ albums }: BentoGridContainerProps) {
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  /**
   * 앨범 상세 열기
   */
  const onAlbumClick = (album: Album) => {
    setSelectedAlbum(album);
    setIsOpen(true);

    // 배경 그리드 블러/페이드 처리
    if (gridRef.current) {
      gsap.to(gridRef.current, {
        opacity: 0.3,
        scale: 0.98,
        duration: 0.6,
        ease: "power2.out",
      });
    }
  };

  /**
   * 앨범 상세 닫기 (모달 컴포넌트의 onClose에서 호출)
   */
  const handleClose = () => {
    setIsOpen(false);
    setSelectedAlbum(null);

    // 배경 그리드 원복
    if (gridRef.current) {
      gsap.to(gridRef.current, {
        filter: "blur(0px)",
        opacity: 1,
        scale: 1,
        duration: 0.5,
        ease: "power2.inOut",
      });
    }
  };

  /**
   * 스크롤 잠금 관리
   */
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <div className="relative w-full py-10">
      {/* 앨범 그리드 영역 */}
      <div
        ref={gridRef}
        className="mx-auto grid max-w-6xl origin-center grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      >
        {albums.map((album) => (
          <div
            key={album.name}
            onClick={() => onAlbumClick(album)}
            className="group bg-card border-border/50 hover:border-border relative aspect-square cursor-pointer overflow-hidden rounded-[2.5rem] border transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
          >
            <div className="relative h-full w-full">
              <Image
                src={`/images/albums/${album.imageSlug}.webp`}
                alt={album.name}
                fill
                className="object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-80" />
              <div className="absolute right-8 bottom-10 left-8 text-white">
                <h3 className="text-2xl leading-none font-black tracking-tighter drop-shadow-2xl">
                  {album.name.split(":")[0]}
                </h3>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1 w-6 rounded-full" style={{ backgroundColor: album.color }} />
                  <p className="text-[10px] font-bold tracking-widest text-white/60 uppercase">
                    {album.songs.length} Tracks
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 분리된 앨범 상세 모달 */}
      {isOpen && selectedAlbum && <AlbumDetailModal album={selectedAlbum} onClose={handleClose} />}
    </div>
  );
}

// Next.js Image 컴포넌트 사용을 위해 import 추가
import Image from "next/image";
