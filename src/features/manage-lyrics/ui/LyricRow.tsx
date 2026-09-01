"use client";

import { useState } from "react";
import { Paintbrush, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";

import type { LyricLine } from "@/entities/cheer-guide";
import { formatTime, parseTime } from "@/entities/cheer-guide";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";

import { useAdminEditorContext } from "./AdminEditorContext";
import { ExtraSegmentEditor } from "./ExtraSegmentEditor";
import { MobilePaintEditor } from "./MobilePaintEditor";
import { RawTextEditor } from "./RawTextEditor";

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
    lastAddedTimeRef,
    setCurrentIndex,
  } = useAdminEditorContext();

  /**
   * 타임스킬프 입력 로컬 상태
   * blur / Enter 시에만 updateLine을 호출하여 타이핑 중 방해를 없애줍니다.
   * line.startTime이 외부에서 바뀌면 부모(LyricRow)의 key가 변경되어 여기서 새로 마운트됩니다.
   */
  const [localTime, setLocalTime] = useState(formatTime(line.startTime));

  /** 모바일 페인트 에디터 다이얼로그 오픈 상태 */
  const [isMobileEditorOpen, setIsMobileEditorOpen] = useState(false);

  /** 원시 텍스트(Prompt 대체) 에디터 다이얼로그 오픈 상태 */
  const [isRawEditorOpen, setIsRawEditorOpen] = useState(false);

  const commitTime = () => {
    const parsed = parseTime(localTime);
    if (!isNaN(parsed) && parsed >= 0) {
      updateLine(index, { startTime: parsed });
    } else {
      setLocalTime(formatTime(line.startTime));
    }
  };

  return (
    <>
      <div
        className={cn(
          "grid items-center gap-2 rounded-md border p-2 transition-all",
          // lg+: 기존 4컬럼 한 줄 | lg 미만: Time·Extra·Action 1행 + Lyrics 2행
          "grid-cols-[100px_1fr_220px] lg:grid-cols-[100px_1fr_60px_220px]",
          isCurrent
            ? "border-primary/50 bg-accent/50 ring-primary/20 ring-1"
            : "border-border/50 bg-background",
          isError && "border-destructive/50 bg-destructive/5",
        )}
        onClick={() => setCurrentIndex(index)}
      >
        {/* 타임스킬프 입력: 로컬 상태로 관리하여 타이핑 중 방해 없음 */}
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

        {/* isExtra 체크박스 (lg 미만에서 1행에 표시) */}
        <div className="flex justify-center lg:hidden">
          <Checkbox
            checked={line.isExtra}
            onCheckedChange={(c: boolean | "indeterminate") => updateLine(index, { isExtra: !!c })}
            className="data-[state=checked]:bg-qwer-e data-[state=checked]:border-qwer-e"
          />
        </div>

        {/* Action 버튼 그룹 (lg 미만에서 1행에 표시) */}
        <div className="flex justify-end gap-1 lg:hidden">
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-accent h-7 w-7"
            title="텍스트 수정"
            onClick={(e) => {
              e.stopPropagation();
              setIsRawEditorOpen(true);
            }}
          >
            <Pencil size={12} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-accent h-7 w-7"
            title="가사 속성 칠하기 (페인트)"
            onClick={(e) => {
              e.stopPropagation();
              setIsMobileEditorOpen(true);
            }}
          >
            <Paintbrush size={12} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="hover:bg-primary/10 hover:text-primary h-7 w-7"
            title="SYNC"
            onClick={(e) => {
              e.stopPropagation();
              captureTime(index);
            }}
          >
            <RefreshCw size={12} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-qwer-e/70 hover:text-qwer-e hover:bg-qwer-e/10 h-7 w-7"
            title="추임새 추가"
            onClick={(e) => {
              e.stopPropagation();
              const t = addExtraLine(index);
              lastAddedTimeRef.current = t;
            }}
          >
            <Plus size={12} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-7 w-7"
            title="삭제"
            onClick={(e) => {
              e.stopPropagation();
              deleteLine(index);
            }}
          >
            <Trash2 size={12} />
          </Button>
        </div>

        {/* 가사 영역: lg 미만에서 2행 전체 너비, lg+에서 원래 위치 */}
        <div className="col-span-3 lg:col-span-1">
          {line.isExtra ? (
            <ExtraSegmentEditor line={line} lineIndex={index} />
          ) : (
            <div
              className="border-input bg-muted/20 flex min-h-8 items-center overflow-x-auto rounded border px-2 text-sm"
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
        </div>

        {/* isExtra 체크박스 (lg+ 전용, 기존 위치 유지) */}
        <div className="hidden justify-center lg:flex">
          <Checkbox
            checked={line.isExtra}
            onCheckedChange={(c: boolean | "indeterminate") => updateLine(index, { isExtra: !!c })}
            className="data-[state=checked]:bg-qwer-e data-[state=checked]:border-qwer-e"
          />
        </div>

        {/* Action 버튼 그룹 (lg+ 전용, 기존 위치 유지) */}
        <div className="hidden justify-center gap-1 lg:flex">
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground hover:bg-accent h-8 w-8"
            title="텍스트 수정"
            onClick={(e) => {
              e.stopPropagation();
              setIsRawEditorOpen(true);
            }}
          >
            <Pencil size={14} />
          </Button>
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
      <MobilePaintEditor
        isOpen={isMobileEditorOpen}
        onClose={() => setIsMobileEditorOpen(false)}
        line={line}
        lineIndex={index}
      />
      <RawTextEditor
        isOpen={isRawEditorOpen}
        onClose={() => setIsRawEditorOpen(false)}
        line={line}
        lineIndex={index}
      />
    </>
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
