"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import Link from "next/link";
import { useRef, useState } from "react";

import { OfficialBadge } from "@/components/common/OfficialBadge";
import { YoutubePlayer } from "@/components/common/YoutubePlayer";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { useAdWatcher } from "@/hooks/useAdWatcher";
import { Album } from "@/types/album";
import { LyricLine } from "@/types/lyrics";
import { YouTubePlayerInstance } from "@/types/youtube";
import { cn } from "@/utils/utils";

gsap.registerPlugin(ScrollToPlugin);

interface LyricsViewerClientProps {
  song: {
    id: number;
    title: string;
    youtubeId: string;
    lyrics: LyricLine[];
    hasOfficialCheer?: boolean;
  };
  album?: Album;
}

export function LyricsViewerClient({ song, album }: LyricsViewerClientProps) {
  const [player, setPlayer] = useState<YouTubePlayerInstance | null>(null);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 광고 감시 훅 연동
  const isAdPlaying = useAdWatcher(player, song.youtubeId);

  /**
   * 유튜브 재생 시간 업데이트 콜백
   */
  const handleTimeUpdate = (time: number) => {
    if (isAdPlaying) return;

    const index = song.lyrics.findLastIndex((line) => line.startTime <= time);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  /**
   * 가사 스냅 스크롤 (자연스러운 센터링)
   * 상단 스페이서 없이 시작하며, 중앙 지점을 넘었을 때만 스크롤이 작동합니다.
   */
  useGSAP(() => {
    if (currentIndex >= 0 && lineRefs.current[currentIndex] && scrollContainerRef.current) {
      const target = lineRefs.current[currentIndex];
      const container = scrollContainerRef.current;

      // 1. 화면 너비에 따른 동적 조정값 계산 (400px~1200px 사이를 150~50으로 매핑)
      const width = window.innerWidth;
      const adjustment = gsap.utils.mapRange(400, 1200, 150, 100, width);
      // 2. 너무 극단적인 값이 나오지 않도록 제한(선택사항)
      const clampedAdjustment = gsap.utils.clamp(50, 150, adjustment);

      gsap.to(container, {
        scrollTo: {
          y: target!,
          offsetY: container.offsetHeight / 2 - clampedAdjustment, // 사용자 정의 가시 영역 수직 중앙 지점 보존
          autoKill: false,
        },
        duration: 0.6,
        ease: "power2.out",
      });
    }
  }, [currentIndex]);

  return (
    <div className="bg-background flex h-[calc(100vh-64px)] flex-col overflow-hidden md:flex-row">
      {/* 고정 영역: 동영상 + 정보 헤더 */}
      <div className="border-border relative z-20 w-full shrink-0 border-b bg-black shadow-2xl md:h-full md:w-[40%] md:border-r md:border-b-0">
        <div className="flex h-full flex-col">
          <div className="aspect-video w-full">
            <YoutubePlayer
              videoId={song.youtubeId}
              onTimeUpdate={handleTimeUpdate}
              onPlayerReady={setPlayer}
            />
          </div>

          {/* 곡 정보 아코디언 (Desktop & Mobile 통합) */}
          <div className="bg-black px-6 py-2 md:p-8">
            <Accordion type="single" collapsible className="border-none">
              <AccordionItem value="song-info" className="border-none">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex flex-1 items-center gap-3 overflow-hidden">
                      <h1 className="truncate text-xl font-black tracking-tight text-white md:text-2xl">
                        {song.title}
                      </h1>
                      {song.hasOfficialCheer && <OfficialBadge type="e" className="shrink-0" />}
                    </div>
                    {album && (
                      <div className="flex flex-col gap-1">
                        <Link
                          href={`/albums/${album.imageSlug}`}
                          className="text-qwer-w inline-block text-sm font-bold transition-colors hover:underline"
                        >
                          {album.name}
                        </Link>
                      </div>
                    )}
                  </div>

                  <AccordionTrigger className="py-2 text-white/50 hover:no-underline">
                    <span className="sr-only">Toggle Info</span>
                  </AccordionTrigger>
                </div>

                <AccordionContent className="pt-2 pb-4">
                  <div className="space-y-4">
                    {album?.name}
                    {album?.officialLink && (
                      <Link
                        href={album.officialLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-qwer-w hover:underline"
                      >
                        {album.name}
                      </Link>
                    )}
                    {/* 향후 여기에 작곡/작사 등 추가 정보 삽입 가능 */}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>

        {/* 광고 오버레이 */}
        {isAdPlaying && (
          <div className="bg-background/80 absolute inset-0 z-30 flex items-center justify-center backdrop-blur-md">
            <div className="animate-pulse p-6 text-center">
              <p className="text-destructive text-xl font-bold tracking-widest uppercase">
                Ad Playing...
              </p>
            </div>
          </div>
        )}
      </div>

      {/* 가사 스크롤 영역 */}
      <div
        ref={scrollContainerRef}
        className="custom-scrollbar ios-touch flex-1 overflow-x-hidden overflow-y-auto px-6 md:px-10"
      >
        <div className="mx-auto max-w-3xl py-12 md:py-20">
          {/* 가사 목록 */}
          <div className="space-y-8 md:space-y-10">
            {song.lyrics.map((line, index) => {
              const isActive = index === currentIndex;

              return (
                <div
                  key={index}
                  ref={(el) => {
                    lineRefs.current[index] = el;
                  }}
                  onClick={() => player?.seekTo(line.startTime, true)}
                  className={cn(
                    "group origin-left cursor-pointer transition-all duration-700 ease-out",
                    isActive
                      ? "translate-x-2 scale-105 opacity-100"
                      : "hover:blur-0 scale-100 opacity-15 blur-[0.5px] hover:opacity-50",
                  )}
                >
                  {line.isExtra ? (
                    <div
                      className={cn(
                        "inline-block rounded-xl px-5 py-2 text-lg font-black italic shadow-lg transition-colors md:px-6 md:py-3 md:text-xl",
                        isActive ? "bg-qwer-e text-black" : "bg-qwer-e/10 text-qwer-e/50",
                      )}
                    >
                      {line.segments[0]?.text}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "text-xl leading-tight font-bold tracking-tighter transition-colors md:text-2xl",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {line.segments.map((seg, sIdx) => (
                        <span
                          key={sIdx}
                          className={cn(
                            "wrap-break-word whitespace-pre-wrap",
                            seg.isEcho &&
                              "text-qwer-r decoration-qwer-r/40 underline underline-offset-8 md:underline-offset-12",
                            seg.isCheer &&
                              !seg.isEcho &&
                              "text-qwer-bwg decoration-qwer-bwg/40 underline underline-offset-8 md:underline-offset-12",
                          )}
                        >
                          {seg.text}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* [Bottom Spacer] 마지막 가사가 중앙에 올 수 있도록 공간 확보 */}
          <div className="h-[50vh]" />
        </div>
      </div>
    </div>
  );
}
