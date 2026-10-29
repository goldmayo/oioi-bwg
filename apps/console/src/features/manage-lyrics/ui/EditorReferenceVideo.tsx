"use client";

import { Input } from "@/shared/ui/input";
import { YouTubePlayer } from "@/shared/ui/YouTubePlayer";

import { useLyricsEditorContext } from "./LyricsEditorContext";
export function EditorReferenceVideo() {
  const editor = useLyricsEditorContext();
  return (
    <section
      aria-labelledby="reference-video-heading"
      className="grid grid-cols-[1.05fr_1fr] items-center gap-x-3 lg:block lg:pb-5"
    >
      <h2
        id="reference-video-heading"
        className="col-start-2 row-start-1 text-sm font-semibold lg:mb-3"
      >
        참고 영상
      </h2>
      <div className="col-start-1 row-span-2 row-start-1">
        <YouTubePlayer
          key={editor.youtubeId}
          videoId={editor.youtubeId}
          onTimeUpdate={editor.handleTimeUpdate}
          onPlayerReady={editor.setPlayer}
          onStateChange={editor.setPlayerState}
        />
      </div>
      <label className="text-muted-foreground col-start-2 row-start-2 flex min-w-0 flex-col gap-1 text-xs lg:mt-3 lg:flex-row lg:items-center lg:gap-2">
        <span className="shrink-0">영상 주소</span>
        <Input
          value={editor.youtubeId}
          onChange={editor.handleYoutubeIdChange}
          placeholder="YouTube URL 또는 ID"
          className="h-8 min-w-0 text-xs"
        />
      </label>
      {editor.isAdPlaying && (
        <p role="status" className="text-muted-foreground col-span-2 mt-2 text-xs leading-5">
          광고 재생 중에는 시간 캡처와 노트 이동을 멈춥니다.
        </p>
      )}
    </section>
  );
}
