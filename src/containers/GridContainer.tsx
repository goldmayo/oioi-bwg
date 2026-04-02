"use client";

import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import { Album } from "@/shared/types/album";
import { analytics } from "@/shared/utils/analytics";

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
        className="mx-auto grid max-w-6xl origin-center grid-cols-1 gap-8 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4"
      >
        {albums.map((album) => (
          <Link
            key={album.name}
            href={`/albums/${album.imageSlug}`}
            scroll={false}
            prefetch={false}
            onClick={() => analytics.trackAlbumClick(album.name, album.imageSlug)}
            className="group bg-card border-border/50 hover:border-border relative aspect-square cursor-pointer overflow-hidden rounded-2xl border transition-all duration-500 hover:-translate-y-3 hover:shadow-[0_20px_50px_rgba(0,0,0,0.3)]"
          >
            <div className="relative h-full w-full">
              <Image
                src={`${process.env.NEXT_PUBLIC_ASSETS_URL}/images/albums/${album.imageSlug}.webp`}
                alt={album.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw"
                loading="eager"
                className="object-cover transition-transform duration-1000 group-hover:scale-110"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black/90 via-black/20 to-transparent opacity-60 transition-opacity group-hover:opacity-80" />
              <div className="absolute right-8 bottom-10 left-8 text-left text-white">
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
          </Link>
        ))}
      </div>
    </div>
  );
}
