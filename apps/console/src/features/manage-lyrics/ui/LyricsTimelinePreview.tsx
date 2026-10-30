"use client";

import { useEffect, useRef } from "react";
import type { LyricLine } from "@oioi-bwg/contracts/song";
import gsap from "gsap";

import { getEditorNotes } from "../lib/editor-notes";

import { NoteText } from "./NoteText";

interface LyricsTimelinePreviewProps {
  lyrics: LyricLine[];
  subscribeToTime: (listener: (time: number) => void) => () => void;
}

export function LyricsTimelinePreview({ lyrics, subscribeToTime }: LyricsTimelinePreviewProps) {
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
    <div className="border-border bg-background relative flex h-full w-full items-center overflow-hidden rounded border">
      {/* 중앙 판정선 */}
      <div className="bg-destructive absolute top-0 bottom-0 left-1/2 z-10 w-0.5" />

      {/* 움직이는 레일 */}
      <div
        ref={railRef}
        className="absolute top-0 bottom-0 left-1/2 flex items-center will-change-transform"
      >
        {getEditorNotes(lyrics).map((note) => (
          <span
            key={note.id}
            data-preview-time={note.time}
            className="bg-muted absolute top-1/2 -translate-y-1/2 rounded px-3 py-1.5 text-sm whitespace-nowrap"
            style={{ left: note.time * PIXELS_PER_SECOND }}
          >
            <NoteText note={note} className="whitespace-pre" />
          </span>
        ))}
      </div>
    </div>
  );
}
