"use client";

import { useEffect, useRef } from "react";
import { Copy, Minus, Plus, ScanLine, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Checkbox } from "@/shared/ui/checkbox";
import { Input } from "@/shared/ui/input";

import type { EditorNote, NoteEdit } from "../lib/editor-notes";
import { formatTime } from "../lib/lrc-parser";

import { useLyricsEditorContext } from "./LyricsEditorContext";
export function NoteInspector({
  note,
  shownTime,
  duration,
  blocked,
  focusVersion,
  onEdit,
}: {
  note?: EditorNote;
  shownTime?: number;
  duration: number;
  blocked: boolean;
  focusVersion: number;
  onEdit: (edit: NoteEdit) => void;
}) {
  const editor = useLyricsEditorContext();
  const content = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (focusVersion) content.current?.focus();
  }, [focusVersion]);
  return (
    <section
      className="border-border border-t py-5"
      aria-labelledby="note-inspector-heading"
      data-note-inspector
    >
      <Button
        variant="outline"
        size="sm"
        className="mb-4 lg:hidden"
        onClick={() =>
          document.getElementById("editor-note-tracks")?.scrollIntoView({ block: "start" })
        }
      >
        노트 트랙으로 돌아가기
      </Button>
      <h2 id="note-inspector-heading" className="mb-4 text-sm font-semibold">
        선택한 노트
      </h2>
      {note ? (
        <>
          <label className="mb-4 flex items-center gap-2 text-xs">
            <Checkbox
              checked={editor.lyrics[note.lineIndex].isExtra}
              disabled={blocked}
              onCheckedChange={(value) =>
                editor.updateLine(note.lineIndex, { isExtra: value === true })
              }
            />
            추가 응원 행
          </label>
          <div className="mb-4 max-h-72 space-y-4 overflow-auto" data-note-segments>
            {note.segments.map((segment, index) => (
              <div key={segment.segmentIndex} className="border-border border-b pb-3 last:border-0">
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
                  <label className="text-qwer-r flex items-center gap-2">
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
                  <label className="text-qwer-w flex items-center gap-2">
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
          <label className="flex flex-col gap-2 text-xs">
            시작 시각 (초)
            <Input
              type="number"
              min={0}
              max={duration}
              step="0.01"
              aria-label="노트 시작 시각"
              value={shownTime ?? note.time}
              disabled={blocked}
              className="font-mono tabular-nums"
              onChange={(event) => {
                const time = event.currentTarget.valueAsNumber;
                if (Number.isFinite(time))
                  onEdit({
                    type: "move",
                    id: note.id,
                    time: Math.max(0, Math.min(duration, time)),
                  });
              }}
            />
          </label>
          <output className="text-muted-foreground mt-2 block font-mono text-xs tabular-nums">
            {formatTime(shownTime ?? note.time)}
          </output>
          <h3 className="mt-6 mb-3 text-xs font-semibold">미세 조정</h3>
          <div className="grid grid-cols-2 gap-2">
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
          <div className="mt-3 flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              aria-label="노트 0.5초 뒤에 복제"
              disabled={blocked || note.time + 0.5 > duration}
              onClick={() => onEdit({ type: "duplicate", id: note.id, time: note.time + 0.5 })}
            >
              <Copy size={14} />
              복제 (+0.5초)
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="선택 노트 삭제"
              disabled={blocked}
              onClick={() => onEdit({ type: "delete", id: note.id })}
            >
              <Trash2 size={14} />
            </Button>
          </div>
          <div className="border-border mt-5 border-t pt-4">
            <p className="text-muted-foreground mb-2 text-xs">선택 행 전체 조정</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                aria-label="선택 행 0.1초 앞당기기"
                disabled={blocked}
                onClick={() => editor.applyRowOffset(-0.1)}
              >
                −0.1s
              </Button>
              <Button
                variant="outline"
                size="sm"
                aria-label="선택 행 0.1초 늦추기"
                disabled={blocked}
                onClick={() => editor.applyRowOffset(0.1)}
              >
                +0.1s
              </Button>
              <Button
                variant="outline"
                size="icon"
                aria-label="선택 행 시간 캡처"
                disabled={blocked || !editor.player}
                onClick={() => editor.captureTime(editor.currentIndex)}
              >
                <ScanLine size={14} />
              </Button>
            </div>
          </div>
        </>
      ) : (
        <p className="text-muted-foreground text-xs leading-5">
          트랙을 클릭해 노트를 추가하거나 기존 노트를 선택합니다.
        </p>
      )}
    </section>
  );
}
