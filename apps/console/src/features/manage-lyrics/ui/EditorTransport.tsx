"use client";

import { useEffect, useState } from "react";
import { Pause, Play, ScanLine, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { formatTime } from "../lib/lrc-parser";

import { useLyricsEditorContext } from "./LyricsEditorContext";

export function EditorTransport() {
  const editor = useLyricsEditorContext();
  const [time, setTime] = useState(0);
  const { subscribeToTime } = editor;
  useEffect(() => subscribeToTime(setTime), [subscribeToTime]);
  const playing = editor.playerState === 1;
  const seekCue = (direction: -1 | 1) => {
    const choices = editor.lyrics
      .map((line, index) => ({ time: line.startTime, index }))
      .filter((line) => (direction < 0 ? line.time < time - 0.01 : line.time > time + 0.01))
      .sort((a, b) => direction * (a.time - b.time));
    const next = choices[0];
    if (next) {
      editor.setCurrentIndex(next.index);
      editor.player?.seekTo(next.time, true);
    }
  };
  return (
    <div
      role="toolbar"
      aria-label="재생과 시간 캡처"
      className="flex flex-wrap items-center justify-center gap-3"
    >
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          aria-label="이전 Cue로 이동"
          disabled={!editor.player || editor.isAdPlaying}
          onClick={() => seekCue(-1)}
        >
          <SkipBack size={15} />
        </Button>
        <Button
          size="icon"
          aria-label={playing ? "일시정지" : "재생"}
          disabled={!editor.player || editor.isAdPlaying}
          onClick={() => {
            if (playing) editor.player?.pauseVideo();
            else editor.player?.playVideo();
          }}
        >
          {playing ? <Pause size={15} /> : <Play size={15} />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="다음 Cue로 이동"
          disabled={!editor.player || editor.isAdPlaying}
          onClick={() => seekCue(1)}
        >
          <SkipForward size={15} />
        </Button>
        <div className="ml-2 flex flex-col gap-0.5 font-mono tabular-nums sm:flex-row sm:items-baseline sm:gap-3">
          <output className="text-sm" aria-label="현재 재생 시각">
            {formatTime(time)}
          </output>
          <span className="text-muted-foreground text-xs">
            / {formatTime(editor.player?.getDuration() || 0)}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!editor.player || editor.isAdPlaying || !editor.lyrics.length}
          onClick={() => editor.captureTime(editor.currentIndex)}
          className="text-xs"
        >
          <ScanLine size={14} />
          <kbd>Q</kbd>시간 캡처
        </Button>
      </div>
    </div>
  );
}
