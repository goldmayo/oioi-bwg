"use client";

import { ScrollArea } from "@/shared/ui/scroll-area";

import { LyricRow } from "./LyricRow";
import { useLyricsEditorContext } from "./LyricsEditorContext";

/**
 * 가사 편집 테이블 컨테이너.
 *
 * - 테이블 헤더 (Time / Lyrics / Extra / Action)
 * - ScrollArea 내부에 LyricRow 목록 렌더링
 * - 컨테이너 클릭 시 드래그 툴바 닫기
 */
export function LyricsTable() {
  const { lyrics, currentIndex, setToolbar } = useLyricsEditorContext();

  return (
    <div className="border-border bg-card flex h-full flex-col overflow-hidden rounded-lg border shadow-sm">
      {/* 테이블 헤더 */}
      <div className="border-border bg-muted/50 text-muted-foreground grid shrink-0 grid-cols-[100px_1fr_220px] gap-2 border-b p-3 text-xs font-bold tracking-wider uppercase lg:grid-cols-[100px_1fr_60px_220px]">
        <div className="text-center">Time</div>
        <div className="hidden text-center lg:block">Lyrics</div>
        <div className="text-center">Extra</div>
        <div className="text-center">Action</div>
      </div>

      {/* 가사 행 목록 */}
      <ScrollArea className="h-full flex-1">
        <div className="flex flex-col gap-1 p-2 pb-10" onMouseDown={() => setToolbar(null)}>
          {lyrics.map((line, index) => {
            const isError = index > 0 && line.startTime < lyrics[index - 1].startTime;

            return (
              <LyricRow
                key={index}
                line={line}
                index={index}
                isCurrent={index === currentIndex}
                isError={isError}
              />
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
