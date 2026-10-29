"use client";

import { Settings2 } from "lucide-react";

import { Input } from "@/shared/ui/input";
import { YouTubePlayer } from "@/shared/ui/YouTubePlayer";

import { useLyricsEditorContext } from "./LyricsEditorContext";
export function EditorReferenceVideo() {
  const editor = useLyricsEditorContext();
  return (
    <section
      aria-labelledby="reference-video-heading"
      className="flex h-full min-h-0 flex-col gap-3"
    >
      <div className="flex h-10 shrink-0 items-center justify-between">
        <h2 id="reference-video-heading" className="text-sm font-medium">
          참고 영상
        </h2>
        <details className="relative">
          <summary
            role="button"
            aria-label="영상 설정"
            title="영상 설정"
            className="hover:bg-accent flex size-8 cursor-pointer list-none items-center justify-center rounded-md [&::-webkit-details-marker]:hidden"
          >
            <Settings2 size={15} />
          </summary>
          <label className="bg-popover border-border absolute top-10 right-0 z-30 flex w-72 max-w-[85vw] flex-col gap-2 rounded border p-3 text-xs shadow-lg">
            <span>영상 주소</span>
            <Input
              value={editor.youtubeId}
              onChange={editor.handleYoutubeIdChange}
              placeholder="YouTube URL 또는 ID"
              className="h-8 min-w-0 text-xs"
            />
          </label>
        </details>
      </div>
      <div data-editor-video className="flex min-h-0 flex-1 items-start [&>div]:max-h-full">
        <YouTubePlayer
          key={editor.youtubeId}
          videoId={editor.youtubeId}
          onTimeUpdate={editor.handleTimeUpdate}
          onPlayerReady={editor.setPlayer}
          onStateChange={editor.setPlayerState}
        />
      </div>
      {editor.isAdPlaying && (
        <p role="status" className="text-muted-foreground text-xs">
          광고 재생 중에는 시간 캡처와 노트 이동을 멈춥니다.
        </p>
      )}
    </section>
  );
}
