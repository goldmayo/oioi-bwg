"use client";

import { useState } from "react";
import type { LyricLine } from "@oioi-bwg/contracts/song";
import { Paintbrush, Pencil, Plus, ScanLine, Trash2 } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";

import { formatTime, parseTime } from "../lib/lrc-parser";

import { ExtraSegmentEditor } from "./ExtraSegmentEditor";
import { useLyricsEditorContext } from "./LyricsEditorContext";
import { MobilePaintEditor } from "./MobilePaintEditor";
import { RawTextEditor } from "./RawTextEditor";

interface LyricRowProps {
  line: LyricLine;
  index: number;
  isCurrent: boolean;
  isError: boolean;
}
function LyricRowInner({ line, index, isCurrent, isError }: LyricRowProps) {
  const editor = useLyricsEditorContext();
  const [time, setTime] = useState(formatTime(line.startTime));
  const [paintOpen, setPaintOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const commit = () => {
    const parsed = parseTime(time);
    if (Number.isFinite(parsed) && parsed >= 0) editor.updateLine(index, { startTime: parsed });
    else setTime(formatTime(line.startTime));
  };
  return (
    <>
      <div
        data-lyric-row={index}
        aria-current={isCurrent ? "true" : undefined}
        className={cn(
          "border-border/60 border-b px-3",
          isCurrent && "bg-qwer-e/10 ring-qwer-e/40 ring-1 ring-inset",
          isError && "bg-destructive/10",
        )}
        onClick={() => editor.setCurrentIndex(index)}
      >
        <div className="grid min-h-12 grid-cols-[22px_92px_minmax(0,1fr)_64px] items-center gap-2">
          <button
            aria-label={`${index + 1}행 선택`}
            className={cn(
              "text-muted-foreground h-9 text-xs tabular-nums",
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
            className="flex min-w-0 items-center gap-2 overflow-hidden text-sm"
            onMouseUp={(e) => editor.handleMouseUpText(e, index)}
          >
            {line.segments.map((segment, i) => (
              <span
                key={i}
                data-line={index}
                data-seg={i}
                className={cn(
                  "shrink-0 whitespace-pre",
                  line.isExtra && "text-qwer-e",
                  segment.isCheer && "text-qwer-r font-semibold",
                  segment.isEcho && "text-qwer-w underline underline-offset-4",
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
              className="size-8"
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
              className="size-8"
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
        {isCurrent && (
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
                속성 칠하기
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
