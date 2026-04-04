"use client";

import { useGSAP } from "@gsap/react";
import { cva } from "class-variance-authority";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import Link from "next/link";
import { useRef, useState } from "react";

// import { OfficialBadge } from "@/components/common/OfficialBadge";
import { useAdWatcher } from "@/shared/hooks/useAdWatcher";
import { Album } from "@/shared/types/album";
import { LyricLine } from "@/shared/types/lyrics";
import { YouTubePlayerInstance } from "@/shared/types/youtube";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/shared/ui/accordion";
import { YoutubePlayer } from "@/shared/ui/YoutubePlayer";
import { analytics } from "@/shared/utils/analytics";
import { cn } from "@/shared/utils/utils";

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

  const handleLyricClick = (line: LyricLine) => {
    player?.seekTo(line.startTime, true);
    const fullText = line.segments.map((s) => s.text).join(" ");
    analytics.trackLyricClick(song.title, fullText, line.startTime);
  };

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
        duration: 0.09,
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
      </div>

      {/* 가사 스크롤 영역 */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-x-hidden overflow-y-auto px-6 md:px-10"
      >
        <div className="mx-auto max-w-3xl py-12 md:py-20">
          {/* 가사 목록 */}
          <div className="xs:space-y-6 space-y-5 text-center text-lg sm:space-y-7 sm:text-xl md:space-y-9 md:text-2xl">
            {song.lyrics.map((line, index) => (
              <LyricLineItem
                key={index}
                line={line}
                index={index}
                isActive={index === currentIndex}
                activeSeg={activeSegmentIndex}
                onLineRef={(el) => {
                  lineRefs.current[index] = el;
                }}
                onClick={() => handleLyricClick(line)}
              />
            ))}
          </div>

          {/* [Bottom Spacer] 마지막 가사가 중앙에 올 수 있도록 공간 확보 */}
          <div className="h-[50vh]" />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 로컬 컴포넌트 & CVA (Class Variance Authority) 스타일 정의
// ----------------------------------------------------------------------

const lyricContainerVariants = cva("transition-colors", {
  variants: {
    variant: {
      extra: "inline-flex flex-wrap gap-2 shadow-lg",
      normal: "leading-tight font-bold tracking-tighter",
    },
    isActive: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    { variant: "normal", isActive: true, className: "text-foreground" },
    { variant: "normal", isActive: false, className: "text-muted-foreground" },
  ],
});

const lyricSegmentVariants = cva("transition-colors", {
  variants: {
    variant: {
      extra: "inline-block font-black italic duration-100 md:text-xl",
      normal: "wrap-break-word whitespace-pre-wrap",
    },
    colorState: {
      default: "",
      extraTarget: "text-qwer-e",
      extraUntarget: "text-qwer-e/60",
      echo: "text-qwer-r decoration-qwer-r/40 underline underline-offset-8 md:underline-offset-12",
      cheer:
        "text-qwer-bwg decoration-qwer-bwg/40 underline underline-offset-8 md:underline-offset-12",
    },
  },
});

interface LyricLineItemProps {
  line: LyricLine;
  index: number;
  isActive: boolean;
  activeSeg: number;
  onLineRef: (el: HTMLDivElement | null) => void;
  onClick: () => void;
}

function LyricLineItem({
  line,
  index,
  isActive,
  activeSeg,
  onLineRef,
  onClick,
}: LyricLineItemProps) {
  const variantType = line.isExtra ? "extra" : "normal";
  const wrapperClass = cn(
    "group origin-center cursor-pointer transition-all duration-700 ease-out",
    isActive ? "scale-105 opacity-100" : "blur-0 scale-100 opacity-50 hover:opacity-70",
  );

  return (
    <div ref={onLineRef} onClick={onClick} className={wrapperClass}>
      <div className={lyricContainerVariants({ variant: variantType, isActive })}>
        {line.segments.map((seg, sIdx) => {
          let colorState: "default" | "extraTarget" | "extraUntarget" | "echo" | "cheer" =
            "default";
          if (line.isExtra) {
            colorState = isActive && sIdx === activeSeg ? "extraTarget" : "extraUntarget";
          } else {
            if (seg.isEcho) colorState = "echo";
            else if (seg.isCheer) colorState = "cheer";
          }

          return (
            <span
              key={sIdx}
              className={cn(
                line.isExtra && `seg-${index}-${sIdx}`,
                lyricSegmentVariants({ variant: variantType, colorState }),
              )}
            >
              {seg.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
