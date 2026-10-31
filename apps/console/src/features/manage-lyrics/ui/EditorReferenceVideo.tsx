"use client";

import { Settings2 } from "lucide-react";

import { Input } from "@/shared/ui/input";
import { YouTubePlayer } from "@/shared/ui/YouTubePlayer";

import { useLyricsEditorContext } from "./LyricsEditorContext";
export function EditorReferenceVideo() {
  const editor = useLyricsEditorContext();
  return (
    <section aria-labelledby="reference-video-heading" className="flex min-h-0 flex-col gap-3">
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
      <div data-editor-video className="shrink-0">
        <YouTubePlayer
          key={editor.youtubeId}
          videoId={editor.youtubeId}
          onTimeUpdate={editor.handleTimeUpdate}
          onPlayerReady={editor.setPlayer}
          onStateChange={editor.setPlayerState}
        />
      </div>
      <dl
        aria-label="편집 단축키"
        className="text-muted-foreground border-border mt-2 space-y-2 border-t pt-4 text-xs"
      >
        {[
          ["Space", "재생 / 일시정지"],
          ["N", "노트 추가"],
          ["L", "구간 반복"],
          ["Ctrl/⌘ Z", "실행 취소"],
          ["Ctrl/⌘ Shift Z", "다시 실행"],
          ["Ctrl/⌘ S", "저장"],
          ["Shift + 휠", "좌우 이동"],
        ].map(([keys, label]) => (
          <div key={keys} className="flex items-center justify-between gap-2">
            <dt>{label}</dt>
            <dd>
              <kbd className="border-border rounded border px-1.5 py-0.5 font-mono text-[10px]">
                {keys}
              </kbd>
            </dd>
          </div>
        ))}
      </dl>
      {editor.isAdPlaying && (
        <p role="status" className="text-muted-foreground text-xs">
          광고 재생 중에는 시간 캡처와 노트 이동을 멈춥니다.
        </p>
      )}
    </section>
  );
}
