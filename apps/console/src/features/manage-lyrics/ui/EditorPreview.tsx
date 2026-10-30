"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Eye } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { useAdWatcher } from "@/shared/model/useAdWatcher";
import type { YouTubePlayerInstance } from "@/shared/model/youtube";
import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { YouTubePlayer } from "@/shared/ui/YouTubePlayer";

import { formatTime } from "../lib/lrc-parser";

import { useLyricsEditorContext } from "./LyricsEditorContext";

export function EditorPreview({ blocked }: { blocked: boolean }) {
  const [open, setOpen] = useState(false);
  const editor = useLyricsEditorContext();
  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 px-3"
        title="현재 초안을 사용자 화면으로 미리보기"
        aria-label="현재 초안을 사용자 화면으로 미리보기"
        disabled={blocked}
        onClick={() => {
          editor.player?.pauseVideo();
          setOpen(true);
        }}
      >
        <Eye size={16} />
        미리보기
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90dvh] w-[calc(100vw-24px)] max-w-none flex-col gap-0 overflow-hidden p-0 sm:max-w-5xl">
          <DialogHeader className="border-border shrink-0 border-b px-5 py-4 text-left">
            <DialogTitle>사용자 화면 미리보기</DialogTitle>
            <DialogDescription>현재 편집 중인 초안</DialogDescription>
          </DialogHeader>
          {open && <DraftViewer />}
        </DialogContent>
      </Dialog>
    </>
  );
}
function DraftViewer() {
  const editor = useLyricsEditorContext();
  const cues = useMemo(
    () =>
      editor.lyrics
        .flatMap((line, index) =>
          line.isExtra
            ? line.segments.map((segment) => ({
                line: index,
                time: line.startTime + (segment.startTimeOffset ?? 0),
                offset: segment.startTimeOffset ?? 0,
              }))
            : [{ line: index, time: line.startTime, offset: -1 }],
        )
        .sort((a, b) => b.time - a.time || b.line - a.line),
    [editor.lyrics],
  );
  const [player, setPlayer] = useState<YouTubePlayerInstance | null>(null);
  const [cursor, setCursor] = useState({ line: -1, offset: -1 });
  const container = useRef<HTMLDivElement>(null);
  const isAdPlaying = useAdWatcher(player, editor.youtubeId);
  useEffect(() => {
    player?.seekTo(editor.currentTimeRef.current, true);
  }, [player, editor.currentTimeRef]);
  useEffect(() => {
    const node = container.current;
    const active = node?.querySelector<HTMLElement>('[aria-current="true"]');
    if (node && active)
      node.scrollTo({
        top: active.offsetTop - node.offsetTop - node.clientHeight / 2 + active.clientHeight / 2,
        behavior: "instant",
      });
  }, [cursor.line]);
  return (
    <div className="flex h-[72dvh] min-h-0 flex-col overflow-y-auto md:flex-row md:overflow-hidden">
      <section
        aria-label="영상과 곡 정보"
        className="border-border shrink-0 border-b md:w-2/5 md:overflow-y-auto md:border-r md:border-b-0"
      >
        <YouTubePlayer
          videoId={editor.youtubeId}
          onPlayerReady={setPlayer}
          onTimeUpdate={(time) => {
            if (isAdPlaying) return;
            const cue = cues.find((cue) => cue.time <= time);
            const line = cue?.line ?? -1;
            const offset = cue?.offset ?? -1;
            setCursor((previous) =>
              previous.line === line && previous.offset === offset ? previous : { line, offset },
            );
          }}
        />
        <div className="space-y-2 p-5">
          <p className="text-muted-foreground text-xs">{editor.albumName}</p>
          <h2 className="text-2xl font-bold">{editor.title}</h2>
        </div>
      </section>
      <div
        ref={container}
        role="region"
        aria-label="응원법 가사"
        tabIndex={0}
        className="relative min-h-48 flex-1 overflow-y-auto px-5 py-4 md:py-16"
      >
        {editor.lyrics.map((line, index) => (
          <button
            key={index}
            type="button"
            title={`${formatTime(line.startTime, 3)}로 이동`}
            aria-current={cursor.line === index ? "true" : undefined}
            className={cn(
              "block min-h-9 w-full rounded-sm py-2 text-left text-xl font-bold break-keep hover:bg-white/5 md:text-center md:text-3xl",
              cursor.line === index ? "text-foreground" : "text-muted-foreground",
            )}
            onClick={() => {
              if (!isAdPlaying) player?.seekTo(line.startTime, true);
            }}
          >
            <span className={line.isExtra ? "text-qwer-e inline-flex flex-wrap" : ""}>
              {line.segments.map((segment, segmentIndex) => (
                <span
                  key={segmentIndex}
                  data-preview-segment={segmentIndex}
                  className={cn(
                    "whitespace-pre-wrap",
                    line.isExtra &&
                      segmentIndex > 0 &&
                      (segment.startTimeOffset ?? 0) !==
                        (line.segments[segmentIndex - 1].startTimeOffset ?? 0) &&
                      "ml-2",
                    line.isExtra
                      ? "text-qwer-e"
                      : segment.isEcho
                        ? "text-qwer-r underline underline-offset-4"
                        : segment.isCheer
                          ? "text-qwer-bwg underline underline-offset-4"
                          : undefined,
                    line.isExtra &&
                      cursor.line === index &&
                      (segment.startTimeOffset ?? 0) === cursor.offset &&
                      "underline underline-offset-4",
                  )}
                >
                  {segment.text}
                </span>
              ))}
            </span>
          </button>
        ))}
        {!editor.lyrics.length && <p className="text-muted-foreground text-sm">가사가 없습니다.</p>}
        <div className="h-[35dvh]" />
      </div>
    </div>
  );
}
