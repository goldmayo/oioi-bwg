"use client";

import { Input } from "@/shared/ui/input";
import { YouTubePlayer } from "@/shared/ui/YouTubePlayer";

import { useLyricsEditorContext } from "./LyricsEditorContext";
export function EditorReferenceVideo() {
  const editor = useLyricsEditorContext();
  return (
    <section aria-labelledby="reference-video-heading" className="pb-5">
      <h2 id="reference-video-heading" className="mb-3 text-sm font-semibold">
        참고 영상
      </h2>
      <YouTubePlayer
        key={editor.youtubeId}
        videoId={editor.youtubeId}
        onTimeUpdate={editor.handleTimeUpdate}
        onPlayerReady={editor.setPlayer}
        onStateChange={editor.setPlayerState}
      />
      <label className="text-muted-foreground mt-3 flex items-center gap-2 text-xs">
        <span className="shrink-0">참고 영상</span>
        <Input
          value={editor.youtubeId}
          onChange={editor.handleYoutubeIdChange}
          placeholder="YouTube URL 또는 ID"
          className="h-8 min-w-0 text-xs"
        />
      </label>
      {editor.isAdPlaying && (
        <p role="status" className="text-muted-foreground mt-2 text-xs leading-5">
          광고 재생 중에는 시간 캡처와 노트 이동을 멈춥니다.
        </p>
      )}
    </section>
  );
}
