"use client";

import gsap from "gsap";
import { useEffect, useRef } from "react";

import { LyricLine } from "@/types/lyrics";

interface PreviewRailProps {
  lyrics: LyricLine[];
  subscribeToTime: (listener: (time: number) => void) => () => void;
}

export function PreviewRail({ lyrics, subscribeToTime }: PreviewRailProps) {
  const railRef = useRef<HTMLDivElement>(null);

  // 1초당 이동 픽셀 (속도)
  const PIXELS_PER_SECOND = 150;

  useEffect(() => {
    const unsubscribe = subscribeToTime((time) => {
      if (railRef.current) {
        gsap.set(railRef.current, {
          x: -time * PIXELS_PER_SECOND,
        });
      }
    });

    return unsubscribe;
  }, [subscribeToTime]);

  return (
    <div className="relative flex h-full w-full items-center overflow-hidden rounded border border-border bg-background">
      {/* 중앙 판정선 */}
      <div className="absolute top-0 bottom-0 left-1/2 z-10 w-0.5 bg-destructive" />

      {/* 움직이는 레일 */}
      <div
        ref={railRef}
        className="absolute top-0 bottom-0 left-1/2 flex items-center will-change-transform"
      >
        {lyrics.map((line, index) => {
          const leftPosition = line.startTime * PIXELS_PER_SECOND;
          const segments = line.segments || [];

          return (
            <div
              key={index}
              className="absolute top-1/2 flex -translate-y-1/2 items-center gap-1"
              style={{ left: `${leftPosition}px` }}
            >
              {segments.map((seg, sIdx) => {
                let bgColor = "bg-muted";
                let textColor = "text-muted-foreground";
                
                // 디자인 시스템 멤버 컬러 적용
                if (seg.isEcho) {
                  bgColor = "bg-qwer-w";
                  textColor = "text-white";
                } else if (line.isExtra) {
                  bgColor = "bg-qwer-e";
                  textColor = "text-black"; // 연두색 배경에는 검정 글씨가 시인성이 좋음
                } else if (seg.isCheer) {
                  bgColor = "bg-qwer-r";
                  textColor = "text-white";
                }

                return (
                  <span
                    key={sIdx}
                    className={`rounded-full px-3 py-1.5 text-sm font-bold whitespace-nowrap shadow-md transition-colors ${bgColor} ${textColor}`}
                  >
                    {seg.text}
                  </span>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
