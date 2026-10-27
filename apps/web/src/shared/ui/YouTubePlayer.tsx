"use client";

import { useEffect, useRef, useState } from "react";
import { Play } from "lucide-react";
import Image from "next/image";

import { cn } from "@/shared/lib/utils";
import { YouTubeEvent, YouTubePlayerInstance } from "@/shared/model/youtube";

interface YouTubePlayerProps {
  videoId: string;
  className?: string;
  posterUrl?: string;
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

export function YouTubePlayer({
  videoId,
  onTimeUpdate,
  onStateChange,
  onPlayerReady,
  className,
  posterUrl,
}: YouTubePlayerProps) {
  const playerRef = useRef<YouTubePlayerInstance | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<number>(0);
  const [isReady, setIsReady] = useState(false);
  const [showPoster, setShowPoster] = useState(true);
  const [failed, setFailed] = useState(false);

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
      tag.onerror = () => setFailed(true);
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
          origin: window.location.origin,
        },
        events: {
          onReady: (event: YouTubeEvent) => {
            setIsReady(true);
            // 플레이어 준비 완료 시 부모 컴포넌트에게 인스턴스 전달 (광고 감시용)
            if (onPlayerReady) onPlayerReady(event.target);
          },
          onError: () => {
            setFailed(true);
            setShowPoster(true);
          },
          onStateChange: (event: YouTubeEvent) => {
            if (onStateChangeRef.current) onStateChangeRef.current(event.data);

            // 재생 중(1)일 때만 루프 시작, 멈추면(2) 루프 취소
            if (event.data === YT.PlayerState.PLAYING) {
              setShowPoster(false);
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
    <div
      className={cn(
        "border-border relative aspect-video w-full overflow-hidden border bg-black",
        className,
      )}
    >
      {showPoster && (
        <div className="absolute inset-0 z-10 bg-black">
          <Image
            src={posterUrl || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            fill
            unoptimized
            className="object-cover"
          />
          <button
            type="button"
            aria-label="영상 재생"
            disabled={!isReady || failed}
            onClick={() => playerRef.current?.playVideo()}
            className="focus-visible:outline-qwer-w absolute top-1/2 left-1/2 inline-flex h-12 w-17 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-xl bg-red-600 text-white transition-colors hover:bg-red-500 focus-visible:outline-2 focus-visible:outline-offset-4 disabled:cursor-wait"
          >
            <Play aria-hidden="true" className="size-7 fill-current" />
          </button>
          {failed ? (
            <a
              href={`https://www.youtube.com/watch?v=${videoId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute inset-x-0 bottom-0 bg-black/80 px-4 py-3 text-center text-sm text-white underline underline-offset-4"
            >
              영상을 불러오지 못했어요. YouTube에서 보기
            </a>
          ) : !isReady ? (
            <p
              role="status"
              className="absolute inset-x-0 bottom-0 bg-black/75 px-4 py-2 text-center text-xs text-white"
            >
              영상을 불러오고 있어요.
            </p>
          ) : null}
        </div>
      )}
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
