"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useRef, useState } from "react";

import { YoutubePlayer } from "@/components/admin/YoutubePlayer";
import { OfficialBadge } from "@/components/common/OfficialBadge";
import { useAdWatcher } from "@/hooks/useAdWatcher";
import { cn } from "@/libs/utils";
import { LyricLine } from "@/types/lyrics";
import { YouTubePlayerInstance } from "@/types/youtube";

gsap.registerPlugin(ScrollToPlugin);

interface LyricsViewerClientProps {
  song: {
    id: number;
    title: string;
    youtubeId: string;
    lyrics: LyricLine[];
    hasOfficialCheer?: boolean;
  };
}

export function LyricsViewerClient({ song }: LyricsViewerClientProps) {
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

      gsap.to(container, {
        scrollTo: {
          y: target!,
          offsetY: container.offsetHeight / 2 - 100, // 가시 영역의 수직 중앙 지점
          autoKill: false,
        },
        duration: 0.6,
        ease: "power2.out",
      });
    }
  }, [currentIndex]);

  return (
    <div className="bg-background flex h-[calc(100vh-64px)] flex-col overflow-hidden lg:flex-row">
      {/* 동영상 영역 (모바일 28vh) */}
      <div className="border-border relative z-20 h-[28vh] w-full shrink-0 border-b bg-black shadow-2xl lg:h-full lg:w-[40%] lg:border-r lg:border-b-0">
        {/* <div className="border-border relative z-20 w-full shrink-0 border-b bg-black shadow-2xl lg:h-full lg:w-[40%] lg:border-r lg:border-b-0"> */}
        <div className="flex h-full flex-col justify-center">
          <div className="aspect-video w-full">
            <YoutubePlayer
              videoId={song.youtubeId}
              onTimeUpdate={handleTimeUpdate}
              onPlayerReady={setPlayer}
            />
          </div>

          {/* 곡 제목 및 정보 (Desktop) */}
          <div className="hidden p-8 lg:block">
            <div className="mb-3 flex items-center gap-3">
              <h1 className="text-2xl font-black tracking-tight text-white">{song.title}</h1>
              {song.hasOfficialCheer && <OfficialBadge className="bg-white/10 text-white" />}
            </div>
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
        className="custom-scrollbar ios-touch flex-1 overflow-x-hidden overflow-y-auto px-6 lg:px-12"
      >
        <div className="mx-auto max-w-3xl py-12 lg:py-20">
          {/* 모바일 제목 표시 */}
          <div className="mb-10 lg:hidden">
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-foreground text-xl font-black">{song.title}</h2>
              {song.hasOfficialCheer && <OfficialBadge />}
            </div>
            <div className="bg-qwer-w h-0.5 w-8 rounded-full" />
          </div>

          {/* 가사 목록 */}
          <div className="space-y-8 lg:space-y-10">
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
                        "inline-block rounded-xl px-5 py-2 text-lg font-black italic shadow-lg transition-colors lg:px-6 lg:py-3 lg:text-xl",
                        isActive ? "bg-qwer-e text-black" : "bg-qwer-e/10 text-qwer-e/50",
                      )}
                    >
                      {line.segments[0]?.text}
                    </div>
                  ) : (
                    <div
                      className={cn(
                        "text-xl leading-tight font-bold tracking-tighter transition-colors lg:text-3xl",
                        isActive ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {line.segments.map((seg, sIdx) => (
                        <span
                          key={sIdx}
                          className={cn(
                            "break-words whitespace-pre-wrap",
                            seg.isEcho &&
                              "text-qwer-w decoration-qwer-w/40 underline underline-offset-[8px] lg:underline-offset-[12px]",
                            seg.isCheer && !seg.isEcho && "text-qwer-r",
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
