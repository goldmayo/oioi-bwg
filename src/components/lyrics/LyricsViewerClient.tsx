"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import Link from "next/link";
import { useRef, useState } from "react";

// import { OfficialBadge } from "@/components/common/OfficialBadge";
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
  const [activeSegmentIndex, setActiveSegmentIndex] = useState(-1);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // 광고 감시 훅 연동
  const isAdPlaying = useAdWatcher(player, song.youtubeId);

  /**
   * 유튜브 재생 시간 업데이트 콜백
   * 라인 레벨 + isExtra 라인은 세그먼트 레벨까지 추적
   */
  const handleTimeUpdate = (time: number) => {
    if (isAdPlaying) return;

    const lineIndex = song.lyrics.findLastIndex((line) => line.startTime <= time);
    if (lineIndex !== currentIndex) {
      setCurrentIndex(lineIndex);
      setActiveSegmentIndex(-1); // 라인 변경 시 세그먼트 초기화
    }

    if (lineIndex !== -1) {
      const line = song.lyrics[lineIndex];
      // isExtra 라인에서만 세그먼트 레벨 추적
      if (line.isExtra) {
        const segIndex = line.segments.findLastIndex(
          (seg) => line.startTime + (seg.startTimeOffset ?? 0) <= time,
        );
        if (segIndex !== activeSegmentIndex) {
          setActiveSegmentIndex(segIndex);
        }
      }
    }
  };

  /**
   * 가사 스냅 스크롤 (자연스러운 센터링)
   * 상단 스페이서 없이 시작하며, 중앙 지점을 넘었을 때만 스크롤이 작동합니다.
   */
  // useGSAP(() => {
  //   if (currentIndex >= 0 && lineRefs.current[currentIndex] && scrollContainerRef.current) {
  //     const target = lineRefs.current[currentIndex];
  //     const container = scrollContainerRef.current;

  //     // 1. 화면 너비에 따른 동적 조정값 계산 (400px~1200px 사이를 150~50으로 매핑)
  //     const width = window.innerWidth;
  //     const adjustment = gsap.utils.mapRange(400, 1200, 150, 100, width);
  //     // 2. 너무 극단적인 값이 나오지 않도록 제한(선택사항)
  //     const clampedAdjustment = gsap.utils.clamp(50, 150, adjustment);

  //     gsap.to(container, {
  //       scrollTo: {
  //         y: target!,
  //         offsetY: container.offsetHeight / 2 - clampedAdjustment, // 사용자 정의 가시 영역 수직 중앙 지점 보존
  //         autoKill: false,
  //       },
  //       duration: 0.6,
  //       ease: "power2.out",
  //     });
  //   }
  // }, [currentIndex]);

  /**
   * 가사 스냅 스크롤 (기기 독립적 정중앙 정렬)
   */
  // useGSAP(() => {
  //   if (currentIndex >= 0 && lineRefs.current[currentIndex] && scrollContainerRef.current) {
  //     const target = lineRefs.current[currentIndex];
  //     const container = scrollContainerRef.current;

  //     if (!target || !container) return;

  //     // 1. 컨테이너의 가시적 높이와 현재 타겟(가사 한 줄)의 높이를 가져옵니다.
  //     const containerHeight = container.offsetHeight;
  //     const targetHeight = target.offsetHeight;

  //     // 2. [핵심 로직] 타겟의 중앙을 컨테이너의 중앙에 맞추는 오프셋 계산
  //     // (컨테이너 절반 높이) - (가사 한 줄의 절반 높이)를 오프셋으로 주면
  //     // 가사 라인의 '중앙'이 컨테이너의 '중앙'에 정확히 위치합니다.
  //     const centerOffset = containerHeight / 2 - targetHeight / 2;

  //     gsap.to(container, {
  //       scrollTo: {
  //         y: target,
  //         offsetY: centerOffset,
  //         autoKill: false,
  //       },
  //       duration: 0.6,
  //       ease: "power2.out",
  //     });
  //   }
  // }, [currentIndex]);
  /**
   * 가사 스냅 스크롤 (상단에서 15% 지점에 정렬)
   */
  useGSAP(() => {
    if (currentIndex >= 0 && lineRefs.current[currentIndex] && scrollContainerRef.current) {
      const target = lineRefs.current[currentIndex];
      const container = scrollContainerRef.current;

      if (!target || !container) return;

      const containerHeight = container.offsetHeight;
      const topOffset = containerHeight * 0.15;

      gsap.to(container, {
        scrollTo: {
          y: target,
          offsetY: topOffset,
          autoKill: false,
        },
        duration: 0.6,
        ease: "power2.out",
      });
    }
  }, [currentIndex]);

  /**
   * isExtra 세그먼트 활성화 시 Pop & Glow 애니메이션
   * className 셀렉터 방식으로 특정 세그먼트 span을 타겟황니다.
   */
  useGSAP(() => {
    if (activeSegmentIndex < 0 || currentIndex < 0) return;
    const selector = `.seg-${currentIndex}-${activeSegmentIndex}`;
    gsap.fromTo(
      selector,
      { scale: 1, y: 0, filter: "brightness(1)" },
      {
        scale: 1.02,
        y: -2,
        filter: "brightness(1.5) drop-shadow(0 0 8px rgba(255,255,255,0.8))",
        duration: 0.15,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
      },
    );
  }, [currentIndex, activeSegmentIndex]);

  return (
    <div className="bg-background flex h-[calc(100vh-64px)] flex-col overflow-hidden md:flex-row">
      {/* 고정 영역: 동영상 + 정보 헤더 */}
      <div className="border-border relative z-20 w-full shrink-0 border-b bg-black shadow-2xl md:h-full md:w-[40%] md:border-r md:border-b-0">
        <div className="flex h-full flex-col">
          <div className="aspect-video w-full border-b">
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
                      {/* {song.hasOfficialCheer && <OfficialBadge type="e" className="shrink-0" />} */}
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
        className="flex-1 overflow-x-hidden overflow-y-auto px-6 md:px-10"
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
                      : "blur-0 scale-100 opacity-50 hover:opacity-70",
                  )}
                >
                  {line.isExtra ? (
                    <div
                      className={cn(
                        "inline-flex flex-wrap gap-2 rounded-xl px-5 py-2 text-lg shadow-lg transition-colors md:px-6 md:py-3",
                        isActive ? "bg-qwer-e" : "bg-qwer-e/10",
                      )}
                    >
                      {line.segments.map((seg, sIdx) => (
                        <span
                          key={sIdx}
                          className={cn(
                            `seg-${index}-${sIdx}`,
                            "inline-block font-black italic transition-colors duration-150 md:text-xl",
                            isActive
                              ? sIdx === activeSegmentIndex
                                ? "text-white"
                                : "text-black/70"
                              : "text-qwer-e/50",
                          )}
                        >
                          {seg.text}
                        </span>
                      ))}
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
