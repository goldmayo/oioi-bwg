"use client";

import type { LyricLine } from "@oioi-bwg/contracts/song";
import { Plus, Target, X as CloseIcon } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { useLyricsEditorContext } from "./LyricsEditorContext";

interface ExtraSegmentEditorProps {
  line: LyricLine;
  lineIndex: number;
}

/**
 * isExtra 가사 라인의 세그먼트 목록을 편집하는 전용 컴포넌트.
 *
 * 각 세그먼트마다:
 * - 텍스트 입력 (seg.text)
 * - startTimeOffset 입력 (라인 시작 기준 상대적 시간(초))
 * - 🎯 현재 재생 시간으로 offset 캡처 버튼
 * - ✕ 세그먼트 삭제 버튼
 *
 * 하단: 새 조각 추가 버튼 (addSegmentToExtra)
 */
export function ExtraSegmentEditor({ line, lineIndex }: ExtraSegmentEditorProps) {
  const { updateSegment, captureSegmentOffset, removeSegmentFromExtra, addSegmentToExtra } =
    useLyricsEditorContext();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {line.segments.map((seg, sIdx) => (
        <div
          key={sIdx}
          className="border-qwer-e/30 bg-qwer-e/5 flex items-center gap-1 rounded border p-1"
        >
          {/* 세그먼트 텍스트 입력 */}
          <Input
            aria-label={`${lineIndex + 1}행 ${sIdx + 1}번째 조각 텍스트`}
            value={seg.text}
            onChange={(e) => updateSegment(lineIndex, sIdx, { text: e.target.value })}
            placeholder="텍스트"
            className="border-qwer-e/20 text-qwer-e placeholder:text-qwer-e h-7 w-20 text-xs font-bold"
          />

          {/* startTimeOffset 입력 */}
          <span className="text-qwer-e/80 text-xs">+</span>
          <Input
            aria-label={`${lineIndex + 1}행 ${sIdx + 1}번째 조각 오프셋`}
            type="number"
            step="0.01"
            value={seg.startTimeOffset ?? 0}
            onChange={(e) =>
              updateSegment(lineIndex, sIdx, {
                startTimeOffset: parseFloat(e.target.value),
              })
            }
            className="border-qwer-e/20 text-qwer-e h-7 w-20 font-mono text-xs"
          />
          <span className="text-qwer-e/80 text-xs">s</span>

          {/* 현재 재생 시간으로 offset 캡처 */}
          <Button
            size="icon"
            variant="ghost"
            className="text-qwer-e/70 hover:text-qwer-e hover:bg-qwer-e/10 h-6 w-6"
            title="현재 재생 시간으로 오프셋 캡처"
            onClick={(e) => {
              e.stopPropagation();
              captureSegmentOffset(lineIndex, sIdx);
            }}
          >
            <Target size={11} />
          </Button>

          {/* 세그먼트 삭제 */}
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive/60 hover:text-destructive hover:bg-destructive/10 h-6 w-6"
            title="이 세그먼트 삭제"
            onClick={(e) => {
              e.stopPropagation();
              removeSegmentFromExtra(lineIndex, sIdx);
            }}
          >
            <CloseIcon size={11} />
          </Button>
        </div>
      ))}

      {/* 새 세그먼트 추가 버튼 */}
      <Button
        size="sm"
        variant="ghost"
        className={cn(
          "text-qwer-e border-qwer-e/30 hover:bg-qwer-e/10 h-7 border border-dashed text-xs",
        )}
        onClick={(e) => {
          e.stopPropagation();
          addSegmentToExtra(lineIndex);
        }}
      >
        <Plus size={12} className="mr-1" />
        조각 추가
      </Button>
    </div>
  );
}
