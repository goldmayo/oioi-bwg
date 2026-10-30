"use client";

import { useEffect, useState } from "react";
import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { formatTime } from "../lib/lrc-parser";

import { useLyricsEditorContext } from "./LyricsEditorContext";

export function EditorTransport({ blocked }: { blocked: boolean }) {
  const editor = useLyricsEditorContext();
  const [time, setTime] = useState(0);
  const { subscribeToTime } = editor;
  useEffect(() => subscribeToTime(setTime), [subscribeToTime]);
  const playing = editor.playerState === 1;
  const seekCue = (direction: -1 | 1) => {
    const choices = editor.lyrics
      .map((line, index) => ({ time: line.startTime, index }))
      .filter((note) => (direction < 0 ? note.time < time - 0.01 : note.time > time + 0.01))
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
      className="flex items-center justify-center gap-4"
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          aria-label="이전 행으로 이동"
          disabled={!editor.player || blocked}
          onClick={() => seekCue(-1)}
        >
          <SkipBack className="size-5" />
        </Button>
        <Button
          size="icon"
          className="size-12 rounded-full bg-neutral-50 text-neutral-950 hover:bg-white sm:size-13 [&_svg]:size-5"
          aria-label={playing ? "일시정지" : "재생"}
          disabled={!editor.player || blocked}
          onClick={() => {
            if (playing) editor.player?.pauseVideo();
            else editor.player?.playVideo();
          }}
        >
          {playing ? <Pause className="size-5" /> : <Play className="size-5" />}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="다음 행으로 이동"
          disabled={!editor.player || blocked}
          onClick={() => seekCue(1)}
        >
          <SkipForward className="size-5" />
        </Button>
        <div className="ml-3 flex items-baseline gap-2 font-mono whitespace-nowrap tabular-nums">
          <output className="text-base sm:text-lg" aria-label="현재 재생 시각">
            {formatTime(time, 3)}
          </output>
          <span className="text-muted-foreground text-xs sm:text-sm">
            / {formatTime(editor.player?.getDuration() || 0, 3)}
          </span>
        </div>
      </div>
    </div>
  );
}
