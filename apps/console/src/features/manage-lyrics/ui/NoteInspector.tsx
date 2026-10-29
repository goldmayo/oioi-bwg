"use client";

import { useEffect, useRef } from "react";
import { Copy, Minus, Paintbrush, Plus, ScanLine, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";

import type { EditorNote, NoteEdit } from "../lib/editor-notes";
import { formatTime } from "../lib/lrc-parser";

import { ExtraSegmentEditor } from "./ExtraSegmentEditor";
import { useLyricsEditorContext } from "./LyricsEditorContext";
import { NoteTimeInput } from "./NoteTimeInput";

function NoteRowControls({ note, blocked }: { note: EditorNote; blocked: boolean }) {
  const editor = useLyricsEditorContext();
  const line = editor.lyrics[note.lineIndex];
  const isExtra = line.isExtra;
  return (
    <details className="border-border mt-5 border-t pt-4" data-note-row-controls>
      <summary className="cursor-pointer text-xs font-semibold">
        {note.lineIndex + 1}행 전체 조정{isExtra ? " · 조각 관리" : ""}
      </summary>
      <fieldset className="mt-3 min-w-0 space-y-3" disabled={blocked}>
        <p className="text-muted-foreground text-xs leading-5">
          행 시작 {formatTime(line.startTime)} · 시작을 바꾸면 이 행의 모든 조각이 함께 이동합니다.
        </p>
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            aria-label="선택 행 0.1초 앞당기기"
            onClick={() => editor.applyRowOffset(-0.1)}
          >
            −0.1s
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="선택 행 0.1초 늦추기"
            onClick={() => editor.applyRowOffset(0.1)}
          >
            +0.1s
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          aria-label="선택 행 시간 캡처"
          disabled={!editor.player}
          onClick={() => editor.captureTime(note.lineIndex)}
        >
          <ScanLine size={14} />행 시작을 재생 위치에 맞추기
        </Button>
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            aria-label="추가 응원 행"
            disabled={blocked}
            checked={line.isExtra}
            onCheckedChange={(value) =>
              editor.updateLine(note.lineIndex, { isExtra: value === true })
            }
          />
          이 행 전체를 추가 응원으로 표시
        </label>
        {isExtra && <ExtraSegmentEditor line={line} lineIndex={note.lineIndex} />}
      </fieldset>
    </details>
  );
}

export function NoteInspector({
  note,
  shownTime,
  duration,
  blocked,
  focusVersion,
  onEdit,
  onCapture,
  onPaint,
}: {
  note?: EditorNote;
  shownTime?: number;
  duration: number;
  blocked: boolean;
  focusVersion: number;
  onEdit: (edit: NoteEdit) => void;
  onCapture: () => void;
  onPaint: () => void;
}) {
  const editor = useLyricsEditorContext();
  const content = useRef<HTMLInputElement>(null);
  const line = note && editor.lyrics[note.lineIndex];
  const isExtra = note?.segmentIndex != null;
  useEffect(() => {
    if (focusVersion) content.current?.focus();
  }, [focusVersion]);
  return (
    <section
      className="border-border border-t py-5"
      aria-labelledby="note-inspector-heading"
      data-note-inspector
    >
      <h2 id="note-inspector-heading" className="text-sm font-semibold">
        선택한 노트
      </h2>
      <Button
        variant="outline"
        size="sm"
        className="mt-3 mb-4 lg:hidden"
        onClick={() =>
          document.getElementById("editor-note-tracks")?.scrollIntoView({ block: "start" })
        }
      >
        노트 트랙으로 돌아가기
      </Button>
      {note && line ? (
        <>
          <p className="text-muted-foreground mt-2 mb-4 text-xs" data-note-scope>
            {note.lineIndex + 1}행 ·{" "}
            {isExtra
              ? `추가 응원 ${(note.segmentIndex ?? 0) + 1}/${line.segments.length}번째 조각`
              : `가사 행 전체 · ${line.segments.length}개 조각`}
          </p>
          <NoteTimeInput
            key={note.id}
            time={shownTime ?? note.time}
            duration={duration}
            blocked={blocked}
            onCommit={(time) => onEdit({ type: "move", id: note.id, time })}
          />
          {isExtra && (
            <p className="text-muted-foreground mt-2 text-xs leading-5" data-note-relative-time>
              행 시작 {formatTime(line.startTime)} + {(note.time - line.startTime).toFixed(2)}초
            </p>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-3 w-full"
            disabled={blocked || !editor.player}
            onClick={onCapture}
          >
            <ScanLine size={14} />
            현재 재생 위치에 맞추기<kbd>Q</kbd>
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              aria-label="노트 10ms 앞당기기"
              disabled={blocked}
              onClick={() =>
                onEdit({ type: "move", id: note.id, time: Math.max(0, note.time - 0.01) })
              }
            >
              <Minus size={13} />
              10ms
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="노트 10ms 늦추기"
              disabled={blocked}
              onClick={() =>
                onEdit({ type: "move", id: note.id, time: Math.min(duration, note.time + 0.01) })
              }
            >
              <Plus size={13} />
              10ms
            </Button>
          </div>
          <div className="border-border mt-5 border-t pt-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold">내용 · 강조</h3>
              <Button variant="ghost" size="sm" disabled={blocked} onClick={onPaint}>
                <Paintbrush size={13} />
                글자별 강조 편집
              </Button>
            </div>
            <p className="text-muted-foreground mb-4 text-xs leading-5">
              체크는 해당 조각 전체에 적용됩니다. 글자별 편집은 {note.lineIndex + 1}행에서 범위를
              선택합니다.
            </p>
            <div className="space-y-4" data-note-segments>
              {note.segments.map((segment, index) => (
                <div
                  key={segment.segmentIndex}
                  className="border-border border-b pb-3 last:border-0"
                >
                  <label className="flex flex-col gap-2 text-xs">
                    {note.segments.length === 1 ? "내용" : `조각 ${segment.segmentIndex + 1} 내용`}
                    <Input
                      ref={index === 0 ? content : undefined}
                      aria-label={
                        note.segments.length === 1
                          ? "선택 노트 내용"
                          : `선택 노트 ${segment.segmentIndex + 1}번째 조각 내용`
                      }
                      value={segment.text}
                      disabled={blocked}
                      placeholder="응원 내용을 입력합니다."
                      aria-invalid={!segment.text.length}
                      onChange={(event) =>
                        onEdit({
                          type: "segment",
                          id: note.id,
                          segmentIndex: segment.segmentIndex,
                          value: { text: event.target.value },
                        })
                      }
                    />
                  </label>
                  <div className="mt-2 flex flex-wrap gap-4 text-xs">
                    <label className="text-qwer-bwg flex items-center gap-2 brightness-125">
                      <Checkbox
                        aria-label={`${segment.segmentIndex + 1}번째 조각 응원 강조`}
                        checked={segment.isCheer}
                        disabled={blocked}
                        onCheckedChange={(value) =>
                          onEdit({
                            type: "segment",
                            id: note.id,
                            segmentIndex: segment.segmentIndex,
                            value: { isCheer: value === true },
                          })
                        }
                      />
                      응원
                    </label>
                    <label className="text-qwer-r flex items-center gap-2">
                      <Checkbox
                        aria-label={`${segment.segmentIndex + 1}번째 조각 에코 강조`}
                        checked={segment.isEcho}
                        disabled={blocked}
                        onCheckedChange={(value) =>
                          onEdit({
                            type: "segment",
                            id: note.id,
                            segmentIndex: segment.segmentIndex,
                            value: { isEcho: value === true },
                          })
                        }
                      />
                      에코
                    </label>
                  </div>
                </div>
              ))}
            </div>
            <p className="text-muted-foreground mt-3 text-xs leading-5">
              {isExtra
                ? "추가 응원은 추임새 색으로 표시됩니다."
                : "응원과 에코를 함께 켜면 에코 색으로 표시됩니다."}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              aria-label="노트 0.5초 뒤에 복제"
              disabled={blocked || note.time + 0.5 > duration}
              onClick={() => onEdit({ type: "duplicate", id: note.id, time: note.time + 0.5 })}
            >
              <Copy size={14} />
              {isExtra ? "조각" : "행"} 복제 (+0.5초)
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="선택 노트 삭제"
              title={isExtra ? "선택 조각 삭제" : "선택 행 삭제"}
              disabled={blocked}
              onClick={() => onEdit({ type: "delete", id: note.id })}
            >
              <Trash2 size={14} />
            </Button>
          </div>
          <NoteRowControls note={note} blocked={blocked} />
        </>
      ) : (
        <p className="text-muted-foreground mt-4 text-xs leading-5">
          트랙을 클릭해 노트를 추가하거나 기존 노트를 선택합니다.
        </p>
      )}
    </section>
  );
}
