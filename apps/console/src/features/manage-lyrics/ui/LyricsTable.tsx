"use client";

import { Plus } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { LyricRow } from "./LyricRow";
import { useLyricsEditorContext } from "./LyricsEditorContext";

export function LyricsTable({
  selectedLines,
  onSelectNotes,
}: {
  selectedLines: Map<number, number>;
  onSelectNotes: (index: number, checked: boolean) => void;
}) {
  const editor = useLyricsEditorContext();
  return (
    <section
      className="border-border bg-card/30 flex h-96 min-h-0 min-w-0 flex-col overflow-hidden rounded-md border lg:h-full"
      aria-labelledby="lyrics-heading"
    >
      <div className="border-border flex items-center justify-between gap-3 border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <h2 id="lyrics-heading" className="text-sm font-medium">
            가사
          </h2>
          <span className="text-muted-foreground text-xs">{editor.lyrics.length}행</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            editor.addExtraLine(editor.currentIndex);
          }}
          title="가사 행 추가"
          className="text-xs"
        >
          <Plus size={14} />행 추가
        </Button>
      </div>
      <div className="text-muted-foreground border-border grid grid-cols-[20px_92px_minmax(0,1fr)_88px] gap-2 border-b px-3 py-2 text-xs sm:grid-cols-[20px_24px_112px_minmax(0,1fr)_88px]">
        <span aria-hidden="true" />
        <span className="hidden sm:block">#</span>
        <span>시작 시각</span>
        <span>가사 / 응원</span>
        <span className="text-center">편집</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain" aria-label="가사 행 목록">
        {editor.lyrics.map((line, index) => (
          <LyricRow
            key={index}
            line={line}
            index={index}
            isCurrent={index === editor.currentIndex}
            selected={
              selectedLines.has(index)
                ? selectedLines.get(index) === (line.isExtra ? line.segments.length : 1)
                  ? true
                  : "indeterminate"
                : false
            }
            onSelectNotes={(checked) => onSelectNotes(index, checked)}
            isError={index > 0 && line.startTime < editor.lyrics[index - 1].startTime}
          />
        ))}
        {!editor.lyrics.length && (
          <p className="text-muted-foreground p-6 text-sm leading-6">
            행을 추가해 편집을 시작합니다.
          </p>
        )}
      </div>
    </section>
  );
}
