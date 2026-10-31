"use client";

import { Pause, Play, SkipBack, SkipForward } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { useLyricsEditorContext } from "./LyricsEditorContext";

export function EditorTransport({ blocked }: { blocked: boolean }) {
  const editor = useLyricsEditorContext();
  const playing = editor.playerState === 1;
  const seekCue = (direction: -1 | 1) => {
    const time = editor.currentTimeRef.current;
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
    <div role="toolbar" aria-label="재생 제어" className="flex items-center justify-center gap-4">
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          className="size-9 [&_svg]:size-4"
          size="icon"
          title="이전 행으로 이동"
          aria-label="이전 행으로 이동"
          disabled={!editor.player || blocked}
          onClick={() => seekCue(-1)}
        >
          <SkipBack className="size-5" />
        </Button>
        <Button
          size="icon"
          variant="outline"
          className="size-9 [&_svg]:size-4"
          title={playing ? "일시정지" : "재생"}
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
          variant="outline"
          className="size-9 [&_svg]:size-4"
          size="icon"
          title="다음 행으로 이동"
          aria-label="다음 행으로 이동"
          disabled={!editor.player || blocked}
          onClick={() => seekCue(1)}
        >
          <SkipForward className="size-5" />
        </Button>
      </div>
    </div>
  );
}
