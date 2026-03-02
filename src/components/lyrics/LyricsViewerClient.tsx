"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { useRef, useState } from "react";

import { YoutubePlayer } from "@/components/admin/YoutubePlayer";
import { useAdWatcher } from "@/hooks/useAdWatcher";
import { LyricLine } from "@/types/lyrics";
import { YouTubePlayerInstance } from "@/types/youtube";

gsap.registerPlugin(ScrollToPlugin);

interface LyricsViewerClientProps {
  song: {
    id: number;
    title: string;
    youtubeId: string;
    lyrics: LyricLine[];
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

    // 현재 시간에 맞는 가사 인덱스 찾기
    const index = song.lyrics.findLastIndex((line) => line.startTime <= time);
    if (index !== currentIndex) {
      setCurrentIndex(index);
    }
  };

  /**
   * 가사가 바뀔 때마다 해당 행으로 스마트 스냅 스크롤 (GSAP)
   */
  useGSAP(() => {
    if (currentIndex >= 0 && lineRefs.current[currentIndex] && scrollContainerRef.current) {
      const target = lineRefs.current[currentIndex];
      const container = scrollContainerRef.current;

      // [보정] 활성 가사가 화면 상단 1/3 지점(약 33%)에 오도록 스냅
      // 단, 컨테이너의 스크롤 한계를 고려하여 자연스럽게 이동
      const offset = target!.offsetTop - container.offsetHeight * 0.33;

      gsap.to(container, {
        scrollTo: { y: offset, autoKill: false },
        duration: 0.6,
        ease: "power2.out",
      });
    }
  }, [currentIndex]);

  return (
    <div className="flex h-screen flex-col bg-background lg:flex-row overflow-hidden">
      {/* 
        [Layout] 
        Desktop (lg): 좌측 동영상 (40%), 우측 가사 (60%) 가로 배치
        Mobile: 상단 동영상 (고정), 하단 가사 수직 배치
      */}
      
      {/* 동영상 영역 */}
      <div className="relative z-20 w-full shrink-0 border-b border-border bg-black shadow-2xl lg:h-full lg:w-[40%] lg:border-b-0 lg:border-r">
        <div className="flex h-full flex-col justify-center">
          <div className="aspect-video w-full">
            <YoutubePlayer 
              videoId={song.youtubeId} 
              onTimeUpdate={handleTimeUpdate} 
              onPlayerReady={setPlayer} 
            />
          </div>
          
          {/* 곡 제목 및 정보 (Desktop 전용 하단 표시) */}
          <div className="hidden p-6 lg:block">
            <h1 className="text-2xl font-black tracking-tight text-white">{song.title}</h1>
            <p className="mt-2 text-sm font-medium text-zinc-500 uppercase tracking-widest">OiOiBawige Sync System</p>
          </div>
        </div>

        {/* 광고 오버레이 */}
        {isAdPlaying && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-background/80 backdrop-blur-md">
            <div className="text-center animate-pulse">
              <p className="text-xl font-bold text-destructive uppercase tracking-widest">Ad Playing...</p>
              <p className="text-xs text-muted-foreground mt-2">광고 종료 후 싱크가 재개됩니다.</p>
            </div>
          </div>
        )}
      </div>

      {/* 가사 스크롤 영역 (비중 확대) */}
      <div 
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto px-6 py-[20vh] scrollbar-hide lg:px-12 lg:py-[33vh]"
      >
        <div className="mx-auto max-w-3xl space-y-12 lg:space-y-16">
          {song.lyrics.map((line, index) => {
            const isActive = index === currentIndex;
            
            return (
              <div
                key={index}
                ref={(el) => { lineRefs.current[index] = el; }}
                onClick={() => player?.seekTo(line.startTime, true)}
                className={`group cursor-pointer transition-all duration-700 ease-out ${
                  isActive 
                    ? "scale-105 opacity-100" 
                    : "scale-100 opacity-20 hover:opacity-50 blur-[1px] hover:blur-0"
                }`}
              >
                {line.isExtra ? (
                  /* 추임새 (Extra) 스타일: 가로 스택에서도 명확히 구분되도록 배경 박스 유지 */
                  <div className={`inline-block rounded-xl px-6 py-3 text-xl font-black italic shadow-xl transition-colors ${
                    isActive ? "bg-qwer-e text-black" : "bg-qwer-e/10 text-qwer-e/50"
                  }`}>
                    {line.segments[0]?.text}
                  </div>
                ) : (
                  /* 일반 가사 스타일: 비중 있는 폰트 사이즈 적용 */
                  <div className={`text-3xl font-bold leading-tight tracking-tighter lg:text-4xl ${
                    isActive ? "text-foreground drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]" : "text-muted-foreground"
                  }`}>
                    {line.segments.map((seg, sIdx) => (
                      <span
                        key={sIdx}
                        className={`whitespace-pre ${
                          seg.isEcho 
                            ? "text-qwer-w decoration-qwer-w/40 underline underline-offset-[12px]" 
                            : seg.isCheer 
                              ? "text-qwer-r" 
                              : ""
                        }`}
                      >
                        {seg.text}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          
          {/* 마지막 가사가 중앙에 올 수 있도록 하단 패딩 확보 */}
          <div className="h-[50vh]" />
        </div>
      </div>
    </div>
  );
}
