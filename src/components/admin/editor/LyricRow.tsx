"use client";

import { Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { LyricLine } from "@/types/lyrics";
import { formatTime, parseTime } from "@/utils/lrc-parser";
import { cn } from "@/utils/utils";

import { useAdminEditorContext } from "./AdminEditorContext";
import { ExtraSegmentEditor } from "./ExtraSegmentEditor";

interface LyricRowProps {
  /** 이 행이 표시할 가사 데이터 */
  line: LyricLine;
  /** lyrics 배열에서의 인덱스 */
  index: number;
  /** 현재 재생 중인 행 여부 (하이라이트 표시) */
  isCurrent: boolean;
  /** 이전 행보다 startTime이 작은 오류 상태 여부 */
  isError: boolean;
}

/**
 * 가사 편집 테이블의 개별 행 컴포넌트.
 *
 * - 일반 가사: 드래그 선택으로 Echo/Reset 분리 가능한 텍스트 표시
 * - isExtra:   ExtraSegmentEditor로 세그먼트별 편집 UI 표시
 *
 * 우측 Action 버튼: 텍스트 수정(Pencil) / 시간 캡처(Sync) / 추임새 추가(Plus) / 행 삭제(Trash)
 */
function LyricRowInner({ line, index, isCurrent, isError }: LyricRowProps) {
  const {
    updateLine,
    captureTime,
    addExtraLine,
    deleteLine,
    handleMouseUpText,
    handleEditRawText,
    lastAddedTimeRef,
    setCurrentIndex,
  } = useAdminEditorContext();

  /**
   * 타임스킬프 입력 로컈 상태
   * blur / Enter 시에만 updateLine을 호출하여 타이핑 중 방해를 없애줍니다.
   * line.startTime이 외부에서 바뀌면 부모(LyricRow)의 key가 변경되어 여기서 새로 마운트됩니다.
   */
  const [localTime, setLocalTime] = useState(formatTime(line.startTime));

  const commitTime = () => {
    const parsed = parseTime(localTime);
    if (!isNaN(parsed) && parsed >= 0) {
      updateLine(index, { startTime: parsed });
    } else {
      setLocalTime(formatTime(line.startTime));
    }
  };

  return (
    <div
      className={cn(
        "grid grid-cols-[100px_1fr_60px_220px] items-center gap-2 rounded-md border p-2 transition-all",
        isCurrent
          ? "border-primary/50 bg-accent/50 ring-primary/20 ring-1"
          : "border-border/50 bg-background",
        isError && "border-destructive/50 bg-destructive/5",
      )}
      onClick={() => setCurrentIndex(index)}
    >
      {/* 타임스킬프 입력: 로컈 상태로 관리하여 타이핑 중 방해 없음 */}
      <Input
        type="text"
        value={localTime}
        onChange={(e) => setLocalTime(e.target.value)}
        onBlur={commitTime}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="border-input bg-muted/30 focus-visible:ring-primary/30 h-8 font-mono text-xs"
      />

      {/* 가사 영역: isExtra / 일반 분기 */}
      {line.isExtra ? (
        <ExtraSegmentEditor line={line} lineIndex={index} />
      ) : (
        <div
          className="border-input bg-muted/20 flex h-8 items-center overflow-x-auto rounded border px-2 text-sm"
          onMouseUp={(e) => handleMouseUpText(e, index)}
        >
          {line.segments?.map((seg, sIdx) => (
            <span
              key={sIdx}
              data-line={index}
              data-seg={sIdx}
              className={cn(
                "selection:bg-primary/20 cursor-text whitespace-pre",
                seg.isCheer && "text-qwer-r font-bold",
                seg.isEcho && "text-qwer-r decoration-qwer-r/50 underline underline-offset-4",
              )}
            >
              {seg.text}
            </span>
          ))}
        </div>
      )}

      {/* isExtra 체크박스 */}
      <div className="flex justify-center">
        <Checkbox
          checked={line.isExtra}
          onCheckedChange={(c) => updateLine(index, { isExtra: !!c })}
          className="data-[state=checked]:bg-qwer-e data-[state=checked]:border-qwer-e"
        />
      </div>

      {/* Action 버튼 그룹 */}
      <div className="flex justify-center gap-1">
        {/* 텍스트 직접 수정 */}
        <Button
          size="icon"
          variant="ghost"
          className="text-muted-foreground hover:text-foreground hover:bg-accent h-8 w-8"
          title="텍스트 수정"
          onClick={(e) => {
            e.stopPropagation();
            handleEditRawText(index);
          }}
        >
          <Pencil size={14} />
        </Button>

        {/* 현재 재생 시간으로 타임스탬프 동기화 */}
        <Button
          size="icon"
          variant="ghost"
          className="hover:bg-primary/10 hover:text-primary h-8 w-8"
          title="타임스탬프 동기화 (SYNC)"
          onClick={(e) => {
            e.stopPropagation();
            captureTime(index);
          }}
        >
          <RefreshCw size={14} />
        </Button>

        {/* 아래에 추임새(isExtra) 행 추가 */}
        <Button
          size="icon"
          variant="ghost"
          className="text-qwer-e/70 hover:text-qwer-e hover:bg-qwer-e/10 h-8 w-8"
          title="아래에 추임새 행 추가"
          onClick={(e) => {
            e.stopPropagation();
            const addedTime = addExtraLine(index);
            lastAddedTimeRef.current = addedTime;
          }}
        >
          <Plus size={14} />
        </Button>

        {/* 현재 행 삭제 */}
        <Button
          size="icon"
          variant="ghost"
          className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8"
          title="현재 행 삭제"
          onClick={(e) => {
            e.stopPropagation();
            deleteLine(index);
          }}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}

/**
 * line.startTime을 key로 사용하여 startTime이 외부에서 바뀌면
 * LyricRowInner가 재마운트되어 localTime이 자연스럽게 초기화됩니다.
 * (useEffect 내 setState 경고를 피하는 key prop 패턴)
 */
export function LyricRow(props: LyricRowProps) {
  return <LyricRowInner key={props.line.startTime} {...props} />;
}
