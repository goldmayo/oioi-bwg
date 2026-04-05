"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";

import { AlbumSong } from "@/shared/types/album";
import { analytics } from "@/shared/utils/analytics";
import { cn } from "@/shared/utils/utils";

interface AlbumSongListItemProps {
  song: AlbumSong;
  idx: number;
  albumName: string;
  className?: string;
}

/**
 * [TOBE] 앨범 내 개별 곡 아이템 컴포넌트
 * 아코디언 내부나 검색 결과 등에서 곡 단위로 표시될 때 재사용 가능합니다.
 */
export function AlbumSongListItem({ song, idx, albumName, className }: AlbumSongListItemProps) {
  return (
    <Link
      href={`/songs/${song.slug}`}
      prefetch={false}
      onClick={() => analytics.trackSongClick?.(song.title, albumName)}
      className={cn(
        "flex items-center justify-between px-5 py-4 transition-colors hover:bg-white/5 active:bg-white/10",
        className,
      )}
    >
      <div className="flex items-center gap-4 overflow-hidden">
        {/* 트랙 번호 (바위게 컬러 연하게 적용) */}
        <span className="text-qwer-bwg/40 text-2xs font-black tabular-nums">
          {(idx + 1).toString().padStart(2, "0")}
        </span>

        <div className="flex flex-col leading-tight">
          <span className="truncate text-sm font-bold text-white/90">{song.title}</span>

          {/* 공식 로고/뱃지 */}
        </div>
        {/* {song.hasOfficial && <OfficialBadge type="w" />} */}
      </div>

      {/* 액션문구: 연습하기 */}
      <div className="flex items-center gap-1.5 transition-opacity group-hover:opacity-100">
        <span className="text-qwer-r group-hover:text-primary text-2xs font-black tracking-tighter uppercase transition-colors">
          연습하기
        </span>
        <ChevronRight className="text-qwer-e/60 h-3 w-3" />
      </div>
    </Link>
  );
}
