"use client";

import { ChevronRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Album } from "@/shared/types/album";
import { cn } from "@/shared/utils/utils";

import { AlbumSongListItem } from "./AlbumSongListItem";

interface AlbumListItemProps {
  album: Album;
  className?: string;
}

/**
 * [TOBE] 리코디언(List + Accordion) 기반 앨범 아이템
 * globals.css의 브랜드 컬러 시스템과 라운드 규격을 반영하여 고도화했습니다.
 */
export function AlbumListItem({ album, className }: AlbumListItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 앨범 제목 파싱 로직
  const { mainTitle, subTitle } = useMemo(() => {
    if (!album.name.includes(":")) {
      return { mainTitle: album.name, subTitle: null };
    }
    const [main, ...subParts] = album.name.split(":");
    return { mainTitle: main.trim(), subTitle: subParts.join(":").trim() };
  }, [album.name]);

  const toggleExpand = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsExpanded(!isExpanded);
  };

  return (
    <div
      className={cn(
        "group bg-card/40 border-border/50 overflow-hidden rounded-2xl border transition-all duration-500",
        isExpanded ? "border-white/20 bg-white/5 ring-1 ring-white/10" : "hover:bg-white/5",
        className,
      )}
    >
      {/* 1. 상단 앨범 정보 요약 (클릭 시 아코디언 토글) */}
      <button
        onClick={toggleExpand}
        className="flex h-24 w-full cursor-pointer items-center gap-4 px-3 text-left transition-transform active:scale-[0.98]"
      >
        {/* 썸네일 */}
        <div className="relative ml-2 h-18 w-18 shrink-0 overflow-hidden rounded-xl border border-white/5 shadow-lg">
          <Image
            src={album.imgUrl}
            alt={album.name}
            fill
            sizes="72px"
            loading="eager"
            className="object-cover transition-transform duration-700 group-hover:scale-105"
          />
        </div>

        {/* 텍스트 정보 */}
        <div className="flex flex-1 flex-col justify-center overflow-hidden leading-tight">
          <h3 className="flex flex-col truncate tracking-tighter">
            {subTitle && (
              <span className="mb-0.5 text-sm font-bold text-white/30">{mainTitle}</span>
            )}
            <span
              className={cn("truncate font-black text-white", subTitle ? "text-lg" : "text-xl")}
            >
              {subTitle || mainTitle}
            </span>
          </h3>
          <div className="mt-1.5 flex items-center gap-2">
            <div
              className="h-1 w-3 rounded-full opacity-80"
              style={{ backgroundColor: album.color }}
            />
            <p className="text-2xs font-bold tracking-widest text-white/30 uppercase">
              {album.songs.length} Tracks
            </p>
          </div>
        </div>

        {/* 토글 아이콘 */}
        <div className="mr-2 flex items-center justify-center opacity-40">
          <ChevronRight
            className={cn(
              "h-5 w-5 transition-transform duration-300",
              isExpanded && "rotate-90 text-white opacity-100",
            )}
          />
        </div>
      </button>

      {/* 2. 하단 곡 목록 (확장 영역) */}
      <div
        className={cn(
          "grid transition-all duration-500 ease-in-out",
          isExpanded
            ? "grid-rows-[1fr] border-t border-white/5 opacity-100"
            : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="ios-touch custom-scrollbar overflow-hidden bg-black/20">
          <div className="space-y-px py-2">
            {album.songs.map((song, idx) => (
              <AlbumSongListItem key={song.slug} song={song} idx={idx} albumName={album.name} />
            ))}

            {/* 앨범 상세 페이지 이동 (필요 시 주석 해제) */}
            <Link
              prefetch={false}
              href={`/albums/${album.imageSlug}`}
              className="mt-2 flex w-full items-center justify-center py-4 text-xs font-black tracking-widest text-white/50 transition-colors hover:text-white/60"
            >
              앨범 상세 정보 및 전체 보기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
