"use client";

import { useEffect, useRef, useState } from "react";

import { YouTubeEvent, YouTubePlayerInstance } from "@/types/youtube";

interface YoutubePlayerProps {
  videoId: string;
  onTimeUpdate: (time: number) => void;
  onStateChange?: (state: number) => void;
  // 광고 감지 로직 연동을 위해 플레이어 인스턴스를 부모에게 전달하는 콜백 추가
  onPlayerReady?: (player: YouTubePlayerInstance) => void;
}

// YouTube IFrame API 전역 객체 타입 선언
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

export function YoutubePlayer({
  videoId,
  onTimeUpdate,
  onStateChange,
  onPlayerReady,
}: YoutubePlayerProps) {
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);

  // 콜백 함수들을 항상 최신 상태로 유지하기 위한 refs
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const onStateChangeRef = useRef(onStateChange);

  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    onStateChangeRef.current = onStateChange;
  }, [onTimeUpdate, onStateChange]);

  useEffect(() => {
    if (!videoId) return;

    let isPlaying = false;

    // 재생 시간 폴링 루프
    function updateTime() {
      if (!isPlaying) return;
      if (playerRef.current && typeof playerRef.current.getCurrentTime === "function") {
        const time = playerRef.current.getCurrentTime();
        onTimeUpdateRef.current(time);
      }
      requestRef.current = requestAnimationFrame(updateTime);
    }

    // YouTube API 스크립트 로드
    if (!window.YT) {
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      const firstScriptTag = document.getElementsByTagName("script")[0];
      if (firstScriptTag && firstScriptTag.parentNode) {
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
      }

      window.onYouTubeIframeAPIReady = initPlayer;
    } else {
      initPlayer();
    }

    function initPlayer() {
      if (!containerRef.current) return;

      // 전역 YT 객체 타입 안전성 확보
      const YT = window.YT;
      playerRef.current = new YT.Player(containerRef.current, {
        videoId,
        playerVars: {
          autoplay: 0,
          controls: 1,
          rel: 0,
          modestbranding: 1,
        },
        events: {
          onReady: (event: YouTubeEvent) => {
            setIsReady(true);
            // 플레이어 준비 완료 시 부모 컴포넌트에게 인스턴스 전달 (광고 감시용)
            if (onPlayerReady) onPlayerReady(event.target);
          },
          onStateChange: (event: YouTubeEvent) => {
            if (onStateChangeRef.current) onStateChangeRef.current(event.data);

            // 재생 중(1)일 때만 루프 시작, 멈추면(2) 루프 취소
            if (event.data === YT.PlayerState.PLAYING) {
              if (!isPlaying) {
                isPlaying = true;
                requestRef.current = requestAnimationFrame(updateTime);
              }
            } else {
              isPlaying = false;
              cancelAnimationFrame(requestRef.current);
            }
          },
        },
      });
    }

    return () => {
      isPlaying = false;
      cancelAnimationFrame(requestRef.current);
      if (playerRef.current && typeof playerRef.current.destroy === "function") {
        playerRef.current.destroy();
      }
    };
  }, [videoId, onPlayerReady]); // onPlayerReady를 의존성에 포함

  return (
    <div className="border-border relative aspect-video w-full overflow-hidden rounded-lg border bg-black">
      {!isReady && (
        <div className="text-muted-foreground bg-background/50 absolute inset-0 z-10 flex items-center justify-center text-xs font-bold tracking-widest uppercase backdrop-blur-sm">
          Loading Player...
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
