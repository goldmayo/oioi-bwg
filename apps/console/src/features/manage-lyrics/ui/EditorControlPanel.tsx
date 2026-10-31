"use client";

import { LocateFixed, MapPin, Repeat2 } from "lucide-react";

import { Button } from "@/shared/ui/button";

import type { WaveformImportControls } from "../model/types";

import { useLyricsEditorContext } from "./LyricsEditorContext";
import { WaveformImportButton } from "./WaveformImportButton";

export function EditorControlPanel({
  accountId,
  registration,
  blocked,
  follow,
  onFollow,
  looping,
  loop,
  duration,
  onLoop,
  onRange,
  onAdd,
}: {
  accountId: string;
  registration?: WaveformImportControls;
  blocked: boolean;
  follow: boolean;
  onFollow: () => void;
  looping: boolean;
  loop: { start: number; end: number };
  duration: number;
  onLoop: () => void;
  onRange: (range: { start: number; end: number }) => void;
  onAdd: () => void;
}) {
  const editor = useLyricsEditorContext();
  return (
    <section
      aria-label="컨트롤 패널"
      className="border-border bg-card/30 mx-4 mt-4 flex min-h-24 shrink-0 flex-wrap items-center gap-4 rounded-md border p-4 sm:flex-nowrap sm:gap-8"
    >
      <div className="w-full shrink-0 sm:w-60 xl:w-72">
        {registration && (
          <WaveformImportButton
            accountId={accountId}
            songId={editor.songId}
            videoId={registration.videoId}
            disabled={blocked || editor.isSaving}
            videoChanged={editor.isVideoDirty || editor.youtubeId !== registration.videoId}
            onError={registration.onError}
          />
        )}
      </div>
      <div className="border-border flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:border-l sm:pl-6">
        <Button
          variant="outline"
          size="icon"
          className={`size-9 ${follow ? "border-cyan-500 text-cyan-300" : ""}`}
          title="따라가기"
          aria-label="따라가기"
          aria-pressed={follow}
          disabled={!editor.player}
          onClick={onFollow}
        >
          <LocateFixed size={16} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className={`size-9 ${looping ? "border-cyan-500 text-cyan-300" : ""}`}
          title="구간 반복"
          aria-label="구간 반복"
          aria-pressed={looping}
          disabled={blocked || !editor.player}
          onClick={onLoop}
        >
          <Repeat2 size={16} />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="size-9"
          title="현재 위치에 노트 추가"
          aria-label="현재 위치에 노트 추가"
          disabled={blocked}
          onClick={onAdd}
        >
          <MapPin size={16} />
        </Button>
        {looping && (
          <div aria-label="반복 구간 설정" className="flex flex-wrap items-center gap-2 text-xs">
            <label className="flex items-center gap-1">
              A
              <input
                aria-label="반복 시작 초"
                type="number"
                min={0}
                max={loop.end - 0.1}
                step="0.01"
                className="border-border bg-muted h-7 w-20 rounded border px-1 font-mono"
                value={loop.start}
                onChange={(event) => {
                  const start = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(start) && start >= 0 && start < loop.end)
                    onRange({ start, end: loop.end });
                }}
              />
            </label>
            <label className="flex items-center gap-1">
              B
              <input
                aria-label="반복 끝 초"
                type="number"
                min={loop.start + 0.1}
                max={duration}
                step="0.01"
                className="border-border bg-muted h-7 w-20 rounded border px-1 font-mono"
                value={loop.end}
                onChange={(event) => {
                  const end = event.currentTarget.valueAsNumber;
                  if (Number.isFinite(end) && end > loop.start && end <= duration)
                    onRange({ start: loop.start, end });
                }}
              />
            </label>
            <span className="text-muted-foreground">waveform을 드래그해 A/B 선택</span>
          </div>
        )}
      </div>
    </section>
  );
}
