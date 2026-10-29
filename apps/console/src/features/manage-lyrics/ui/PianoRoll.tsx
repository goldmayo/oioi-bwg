"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

import { type EditorNote, getEditorNotes, type NoteEdit, type NoteLane } from "../lib/editor-notes";
import { formatTime } from "../lib/lrc-parser";
import { useNoteDrag } from "../model/useNoteDrag";

import { useLyricsEditorContext } from "./LyricsEditorContext";
import { NoteText } from "./NoteText";

const lanes: { id: "lyrics" | "extra"; label: string }[] = [
  { id: "lyrics", label: "가사" },
  { id: "extra", label: "추가 응원" },
];
const colors: Record<NoteLane, string> = {
  lyrics: "bg-muted text-foreground border-muted-foreground/60",
  cheer: "bg-qwer-r/10 text-qwer-r border-qwer-r/60",
  echo: "bg-qwer-w/10 text-qwer-w border-qwer-w/60",
  extra: "bg-qwer-e/10 text-foreground border-qwer-e/60",
};
export interface PianoRollInteraction {
  selected?: EditorNote;
  onSelect: (note: EditorNote) => void;
  onEdit: (edit: NoteEdit) => void;
  onPreview: (preview: { id: string; time: number } | null) => void;
}
interface Props extends PianoRollInteraction {
  range: { start: number; end: number };
  duration: number;
  blocked: boolean;
  mode: "select" | "draw";
  onNavigate: (start: number) => void;
}
export function PianoRoll({
  range,
  duration,
  blocked,
  mode,
  onNavigate,
  selected,
  onSelect,
  onEdit,
  onPreview,
}: Props) {
  const editor = useLyricsEditorContext();
  const notes = getEditorNotes(editor.lyrics);
  const span = Math.max(0.01, range.end - range.start);
  const drag = useNoteDrag({
    lyrics: editor.lyrics,
    blocked,
    span,
    duration,
    onSelect,
    onCommit: (id, time) => onEdit({ type: "move", id, time }),
    onPreview,
  });
  const ruler = useRef<HTMLDivElement>(null);
  const [rulerWidth, setRulerWidth] = useState(800);
  useEffect(() => {
    if (!ruler.current) return;
    const observer = new ResizeObserver(([entry]) => setRulerWidth(entry.contentRect.width));
    observer.observe(ruler.current);
    return () => observer.disconnect();
  }, []);
  const ticks: number[] = [];
  const target = span / Math.max(1, Math.floor(rulerWidth / 64));
  const step =
    [1, 2, 5, 10, 15, 30, 60, 120, 300, 600, 1200, 1800, 3600].find((value) => value >= target) ??
    3600;
  for (let time = Math.ceil(range.start / step) * step; time < range.end; time += step)
    ticks.push(time);
  const add = (lane: NoteLane, time: number) => {
    if (!blocked)
      onEdit({ type: "add", lane, time: Math.max(0, Math.min(duration, time)), text: "" });
  };
  return (
    <section
      id="editor-note-tracks"
      aria-label="가사와 응원 노트 트랙"
      data-piano-roll
      data-note-start={range.start}
      data-note-end={range.end}
    >
      <div className="border-border bg-background/60 grid grid-cols-[64px_minmax(0,1fr)] border-y sm:grid-cols-[80px_minmax(0,1fr)]">
        <div className="text-muted-foreground flex items-center justify-center text-xs">초</div>
        <div
          ref={ruler}
          className="relative h-7 overflow-hidden font-mono text-xs tabular-nums"
          aria-hidden="true"
        >
          {ticks.map((time) => (
            <span
              key={time}
              className="text-muted-foreground absolute top-1 whitespace-nowrap"
              style={{ left: `${((time - range.start) / span) * 100}%` }}
            >
              {formatTime(time).slice(0, 5)}
            </span>
          ))}
        </div>
        {lanes.map((lane) => (
          <Lane
            key={lane.id}
            lane={lane}
            notes={notes.filter((note) =>
              lane.id === "extra" ? note.lane === "extra" : note.lane !== "extra",
            )}
            selectedId={selected?.id}
            range={range}
            ticks={ticks}
            blocked={blocked}
            preview={drag.preview}
            onSelect={onSelect}
            onDelete={(id) => onEdit({ type: "delete", id })}
            onAdd={(time) => add(lane.id, time)}
            draw={mode === "draw"}
            drag={drag}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-xs">
        <Button
          variant="outline"
          size="sm"
          className="lg:hidden"
          disabled={!selected}
          onClick={() =>
            document.getElementById("note-inspector-heading")?.scrollIntoView({ block: "start" })
          }
        >
          선택 노트 속성
        </Button>
        <span className="text-muted-foreground">
          {mode === "draw"
            ? "빈 트랙을 클릭해 추가하고 표나 오른쪽에서 내용을 입력합니다."
            : "노트를 선택해 내용과 시각을 편집합니다."}
        </span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            aria-label="이전 노트 구간"
            disabled={range.start <= 0}
            onClick={() => onNavigate(Math.max(0, range.start - span))}
          >
            <ChevronLeft size={15} />
          </Button>
          <span className="font-mono tabular-nums">
            {formatTime(range.start)} – {formatTime(range.end)}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="다음 노트 구간"
            disabled={range.end >= duration}
            onClick={() => onNavigate(Math.min(Math.max(0, duration - span), range.start + span))}
          >
            <ChevronRight size={15} />
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground px-4 py-2 text-xs">
        Esc 이동 취소 · Delete 선택 노트 삭제 · 노트 왼쪽이 시작 시각입니다.
      </p>
    </section>
  );
}
function Lane({
  lane,
  notes,
  selectedId,
  range,
  ticks,
  blocked,
  preview,
  onSelect,
  onDelete,
  onAdd,
  draw,
  drag,
}: {
  lane: (typeof lanes)[number];
  notes: EditorNote[];
  selectedId?: string;
  range: Props["range"];
  ticks: number[];
  blocked: boolean;
  preview: { id: string; time: number } | null;
  onSelect: (note: EditorNote) => void;
  onDelete: (id: string) => void;
  onAdd: (time: number) => void;
  draw: boolean;
  drag: ReturnType<typeof useNoteDrag>;
}) {
  const editor = useLyricsEditorContext();
  const span = range.end - range.start;
  const ordered = [...notes].sort((a, b) => a.time - b.time);
  return (
    <>
      <div className="border-border flex flex-col items-center justify-center gap-1 border-t text-xs">
        <span>{lane.label}</span>
        <Button
          variant="ghost"
          size="icon"
          aria-label={`${lane.label} 노트를 현재 위치에 추가`}
          disabled={blocked}
          className="h-6 w-6"
          onClick={() => onAdd(editor.currentTimeRef.current)}
        >
          <Plus size={12} />
        </Button>
      </div>
      <div
        data-note-track={lane.id}
        role="group"
        aria-label={`${lane.label} 노트 트랙`}
        className="border-border relative h-16 overflow-hidden border-t"
      >
        <button
          type="button"
          aria-label={`${lane.label} 트랙에 노트 추가`}
          disabled={blocked || !draw}
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            onAdd(
              event.detail === 0
                ? editor.currentTimeRef.current
                : range.start + ((event.clientX - box.x) / box.width) * span,
            );
          }}
          className="hover:bg-muted/30 focus-visible:ring-ring absolute inset-0 w-full cursor-crosshair focus-visible:ring-2 focus-visible:ring-inset disabled:cursor-default"
        />
        {ticks.map((time) => (
          <div
            key={time}
            aria-hidden="true"
            className="border-border pointer-events-none absolute inset-y-0 border-l"
            style={{ left: `${((time - range.start) / span) * 100}%` }}
          />
        ))}
        <Playhead range={range} subscribe={editor.subscribeToTime} />
        {ordered.map((note, index) => {
          const time = preview?.id === note.id ? preview.time : note.time;
          if (!Number.isFinite(time) || time < range.start || time >= range.end) return null;
          const later = ordered[index + 1]?.time ?? range.end;
          return (
            <button
              key={note.id}
              type="button"
              data-editor-note={note.id}
              data-note-time={time}
              aria-label={`${lane.label} 노트 ${note.text || "빈 내용"} ${formatTime(time)}`}
              aria-pressed={selectedId === note.id}
              disabled={blocked}
              title={`${note.text || "빈 내용"} · ${formatTime(time)}`}
              onClick={() => onSelect(note)}
              onPointerDown={(event) => drag.onPointerDown(event, note)}
              onPointerMove={drag.onPointerMove}
              onPointerUp={drag.onPointerUp}
              onPointerCancel={drag.cancel}
              onLostPointerCapture={drag.cancel}
              onKeyDown={(event) => {
                if (event.key === "Delete" && !blocked) {
                  event.preventDefault();
                  event.stopPropagation();
                  onDelete(note.id);
                }
              }}
              className={cn(
                "absolute top-2 z-10 h-8 cursor-ew-resize touch-pan-y overflow-hidden rounded border px-2 text-left text-xs font-medium text-ellipsis whitespace-nowrap select-none focus-visible:ring-2 focus-visible:ring-white",
                colors[note.lane],
                selectedId === note.id && "ring-2 ring-white ring-inset",
              )}
              style={{
                left: `${((time - range.start) / span) * 100}%`,
                width: `clamp(24px, calc(${((later - time) / span) * 100}% - 4px), 96px)`,
                maxWidth: `${((range.end - time) / span) * 100}%`,
              }}
            >
              <NoteText note={note} />
            </button>
          );
        })}
      </div>
    </>
  );
}
function Playhead({
  range,
  subscribe,
}: {
  range: Props["range"];
  subscribe: (listener: (time: number) => void) => () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(
    () =>
      subscribe((time) => {
        const position = ((time - range.start) / (range.end - range.start)) * 100;
        if (ref.current) {
          ref.current.style.left = `${Math.max(0, Math.min(100, position))}%`;
          ref.current.hidden = position < 0 || position > 100;
        }
      }),
    [range.start, range.end, subscribe],
  );
  return (
    <div
      ref={ref}
      aria-hidden="true"
      className="bg-foreground pointer-events-none absolute inset-y-0 z-20 w-px"
    />
  );
}
