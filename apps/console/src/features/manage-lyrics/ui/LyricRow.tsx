"use client";

import { useState } from "react";
import type { LyricLine } from "@oioi-bwg/contracts/song";
import { ChevronDown, Paintbrush, Pencil, Plus, ScanLine, Trash2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";

import { formatTime } from "../lib/lrc-parser";

import { ExtraSegmentEditor } from "./ExtraSegmentEditor";
import { lyricEmphasisClass } from "./lyric-emphasis";
import { useLyricsEditorContext } from "./LyricsEditorContext";
import { MobilePaintEditor } from "./MobilePaintEditor";
import { RawTextEditor } from "./RawTextEditor";

interface LyricRowProps {
  line: LyricLine;
  index: number;
  isCurrent: boolean;
  isError: boolean;
  selected: boolean | "indeterminate";
  onSelectNotes: (checked: boolean) => void;
}
function LyricRowInner({
  line,
  index,
  isCurrent,
  isError,
  selected,
  onSelectNotes,
}: LyricRowProps) {
  const editor = useLyricsEditorContext();
  const [time, setTime] = useState(formatTime(line.startTime, 3));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [paintOpen, setPaintOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const commit = () => {
    const text = time.trim();
    const parts = /^(\d+):([0-5]?\d(?:\.\d{1,3})?)$/.exec(text);
    const parsed = parts
      ? Number(parts[1]) * 60 + Number(parts[2])
      : /^\d+(?:\.\d+)?$/.test(text)
        ? Number(text)
        : NaN;
    if (Number.isFinite(parsed) && parsed >= 0) editor.updateLine(index, { startTime: parsed });
    else setTime(formatTime(line.startTime, 3));
  };
  return (
    <>
      <div
        data-lyric-row={index}
        aria-current={isCurrent ? "true" : undefined}
        className={cn(
          "group/lyric-row border-border/60 border-b px-3",
          isCurrent && "bg-qwer-e/10 ring-qwer-e/40 ring-1 ring-inset",
          isError && "bg-destructive/10",
        )}
        onClick={() => editor.setCurrentIndex(index)}
      >
        <div className="grid min-h-12 grid-cols-[20px_92px_minmax(0,1fr)_88px] items-center gap-2 sm:grid-cols-[20px_24px_112px_minmax(0,1fr)_88px]">
          <Checkbox
            aria-label={`${index + 1}행 노트 선택`}
            checked={selected}
            onCheckedChange={(checked) => onSelectNotes(checked === true)}
          />
          <button
            aria-label={`${index + 1}행 선택`}
            className={cn(
              "text-muted-foreground hidden h-9 text-xs tabular-nums sm:block",
              isCurrent && "text-qwer-e",
            )}
          >
            {String(index + 1).padStart(2, "0")}
          </button>
          <Input
            aria-label={`${index + 1}행 시작 시각`}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
                e.currentTarget.blur();
              }
            }}
            className="h-8 px-2 text-center font-mono text-xs tabular-nums"
          />
          <div
            data-row-text
            className="min-w-0 py-2 text-sm break-words"
            onMouseUp={(e) => editor.handleMouseUpText(e, index)}
          >
            {line.segments.map((segment, i) => (
              <span
                key={i}
                data-line={index}
                data-seg={i}
                className={cn(
                  "whitespace-pre-wrap",
                  lyricEmphasisClass(segment, line.isExtra),
                  segment.isCheer && "font-semibold",
                )}
              >
                {segment.text}
              </span>
            ))}
          </div>
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="icon"
              className="size-7 opacity-0 group-hover/lyric-row:opacity-100 focus-visible:opacity-100"
              title="행 상세 편집"
              aria-label={`${index + 1}행 상세 편집`}
              aria-expanded={detailsOpen && isCurrent}
              onClick={() => setDetailsOpen(!detailsOpen)}
            >
              <ChevronDown size={14} className={detailsOpen && isCurrent ? "rotate-180" : ""} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`${index + 1}행 텍스트 수정`}
              onClick={(e) => {
                e.stopPropagation();
                setTextOpen(true);
              }}
            >
              <Pencil size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="size-7"
              aria-label={`${index + 1}행 시간 캡처`}
              disabled={!editor.player || editor.isAdPlaying}
              onClick={(e) => {
                e.stopPropagation();
                editor.captureTime(index);
              }}
            >
              <ScanLine size={14} />
            </Button>
          </div>
        </div>
        {isCurrent && detailsOpen && (
          <div className="pb-3 pl-0 sm:pl-8">
            {line.isExtra && <ExtraSegmentEditor line={line} lineIndex={index} />}
            <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-2 text-xs">
              <label className="mr-auto flex min-h-8 items-center gap-2">
                <Checkbox
                  aria-label={`${index + 1}행 추임새`}
                  checked={line.isExtra}
                  onCheckedChange={(checked) =>
                    editor.updateLine(index, { isExtra: checked === true })
                  }
                />
                추임새
              </label>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => setPaintOpen(true)}
              >
                <Paintbrush size={13} />
                응원·에코 표시
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                onClick={() => {
                  editor.addExtraLine(index);
                }}
              >
                <Plus size={13} />
                아래에 추가
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="text-destructive size-8"
                aria-label={`${index + 1}행 삭제`}
                onClick={() => editor.deleteLine(index)}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        )}
      </div>
      <MobilePaintEditor
        isOpen={paintOpen}
        onClose={() => setPaintOpen(false)}
        line={line}
        lineIndex={index}
      />
      <RawTextEditor
        isOpen={textOpen}
        onClose={() => setTextOpen(false)}
        line={line}
        lineIndex={index}
      />
    </>
  );
}
export function LyricRow(props: LyricRowProps) {
  return <LyricRowInner key={props.line.startTime} {...props} />;
}
