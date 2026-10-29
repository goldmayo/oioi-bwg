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
  { id: "extra", label: "추임새" },
];
const colors: Record<NoteLane, string> = {
  lyrics: "bg-muted text-foreground border-muted-foreground/60",
  cheer: "bg-qwer-bwg/10 border-qwer-bwg/60",
  echo: "bg-qwer-r/10 border-qwer-r/60",
  extra: "bg-cyan-950/20 text-foreground border-cyan-400/70",
};
export interface PianoRollInteraction {
  selected?: EditorNote;
  selectedIds?: string[];
  loop?: { start: number; end: number };
  onLoopRange?: (range: { start: number; end: number }) => void;
  onSelect: (note: EditorNote, additive?: boolean) => void;
  onMove?: (id: string, time: number) => void;
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
  selectedIds = [],
  onMove,
  onLoopRange,
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
    onCommit: (id, time) => (onMove ? onMove(id, time) : onEdit({ type: "move", id, time })),
    selectedNotes: notes.filter((n) => selectedIds.includes(n.id)),
    onPreview,
  });
  const ruler = useRef<HTMLDivElement>(null);
  const loopStart = useRef<number | null>(null);
  const [rulerWidth, setRulerWidth] = useState(800);
  useEffect(() => {
    const cancel = (event: KeyboardEvent) => {
      if (event.key === "Escape" && loopStart.current !== null) {
        loopStart.current = null;
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", cancel, true);
    return () => window.removeEventListener("keydown", cancel, true);
  }, []);
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
      aria-label="가사와 추임새 노트 트랙"
      data-piano-roll
      data-note-start={range.start}
      data-note-end={range.end}
    >
      <div className="border-border bg-background/60 grid grid-cols-[64px_minmax(0,1fr)] border-y sm:grid-cols-[80px_minmax(0,1fr)]">
        <div className="text-muted-foreground flex items-center justify-center text-xs">초</div>
        <div
          ref={ruler}
          className="relative h-7 touch-none overflow-hidden font-mono text-xs tabular-nums"
          title="드래그로 반복 구간 지정"
          onPointerDown={(e) => {
            if (blocked || e.button !== 0) return;
            const box = e.currentTarget.getBoundingClientRect();
            loopStart.current = range.start + ((e.clientX - box.x) / box.width) * span;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerUp={(e) => {
            if (loopStart.current === null) return;
            const box = e.currentTarget.getBoundingClientRect();
            const end = Math.max(
              range.start,
              Math.min(range.end, range.start + ((e.clientX - box.x) / box.width) * span),
            );
            const start = loopStart.current;
            loopStart.current = null;
            if (!blocked && Math.abs(end - start) >= 0.1)
              onLoopRange?.({
                start: Math.round(Math.min(start, end) * 100) / 100,
                end: Math.round(Math.max(start, end) * 100) / 100,
              });
          }}
          onPointerCancel={() => {
            loopStart.current = null;
          }}
          onLostPointerCapture={() => {
            loopStart.current = null;
          }}
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
            selectedIds={selectedIds}
            trackWidth={rulerWidth}
            range={range}
            ticks={ticks}
            blocked={blocked}
            preview={drag.preview}
            previewDelta={
              drag.preview
                ? drag.preview.time -
                  (notes.find((n) => n.id === drag.preview?.id)?.time ?? drag.preview.time)
                : 0
            }
            onSelect={onSelect}
            onAdd={(time) => add(lane.id, time)}
            draw={mode === "draw"}
            drag={drag}
          />
        ))}
      </div>
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 px-4 py-1 text-xs">
        <span>빈 추임새 트랙을 클릭해 노트 추가 · 노트 폭은 문구 길이입니다.</span>
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
    </section>
  );
}
function Lane({
  lane,
  notes,
  selectedIds,
  trackWidth,
  range,
  ticks,
  blocked,
  preview,
  previewDelta,
  onSelect,
  onAdd,
  draw,
  drag,
}: {
  lane: (typeof lanes)[number];
  notes: EditorNote[];
  selectedIds: string[];
  trackWidth: number;
  range: Props["range"];
  ticks: number[];
  blocked: boolean;
  preview: { id: string; time: number } | null;
  previewDelta: number;
  onSelect: (note: EditorNote, additive?: boolean) => void;
  onAdd: (time: number) => void;
  draw: boolean;
  drag: ReturnType<typeof useNoteDrag>;
}) {
  const editor = useLyricsEditorContext();
  const span = range.end - range.start;
  const ordered = [...notes].sort((a, b) => a.time - b.time);
  const ends: number[] = [];
  const rows = new Map<string, number>();

  const timeOf = (note: EditorNote) =>
    note.time +
    (preview && (note.id === preview.id || selectedIds.includes(note.id)) ? previewDelta : 0);
  for (const note of ordered) {
    const time = timeOf(note);
    if (time < range.start || time >= range.end) continue;
    const left = ((time - range.start) / span) * trackWidth;
    const width = Math.min(
      320,
      Math.max(
        76,
        [...(note.text || "문구 입력")].reduce(
          (sum, c) => sum + (c.charCodeAt(0) > 255 ? 13 : 8),
          24,
        ),
      ),
    );
    let row = ends.findIndex((end) => end + 8 <= left);
    if (row < 0) row = ends.length;
    ends[row] = left + width;
    rows.set(note.id, row);
  }
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
        className="border-border relative overflow-hidden border-t"
        style={{ height: Math.max(1, ends.length) * 56 + 8 }}
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
        {ordered.map((note) => {
          const time = timeOf(note);
          if (!Number.isFinite(time) || time < range.start || time >= range.end) return null;
          return (
            <button
              key={note.id}
              type="button"
              data-editor-note={note.id}
              data-note-time={time}
              aria-label={`${lane.label} 노트 ${note.text || "빈 내용"} ${formatTime(time)}`}
              aria-pressed={selectedIds.includes(note.id)}
              disabled={blocked}
              title={`${note.text || "빈 내용"} · ${formatTime(time)}`}
              onClick={(event) => {
                if (event.detail === 0)
                  onSelect(note, event.shiftKey || event.ctrlKey || event.metaKey);
              }}
              onPointerDown={(event) => {
                if (event.shiftKey || event.ctrlKey || event.metaKey) {
                  event.preventDefault();
                  onSelect(note, true);
                } else drag.onPointerDown(event, note);
              }}
              onPointerMove={drag.onPointerMove}
              onPointerUp={drag.onPointerUp}
              onPointerCancel={drag.cancel}
              onLostPointerCapture={drag.cancel}
              className={cn(
                "absolute z-10 h-8 w-max max-w-80 cursor-ew-resize touch-pan-y rounded-md border px-3 text-left text-xs font-medium whitespace-nowrap select-none focus-visible:ring-2 focus-visible:ring-cyan-300",
                colors[note.lane],
                selectedIds.includes(note.id) && "ring-2 ring-cyan-300 ring-inset",
              )}
              style={{
                left: `${((time - range.start) / span) * 100}%`,
                top: 26 + (rows.get(note.id) ?? 0) * 56,
              }}
            >
              {lane.id === "extra" && (
                <span
                  aria-hidden="true"
                  className="text-muted-foreground pointer-events-none absolute -top-5 left-0 flex items-center gap-1 text-[10px] font-normal"
                >
                  <span className="size-1.5 rounded-full bg-cyan-300" />
                  {formatTime(time)}
                </span>
              )}
              <span className="flex min-w-0 items-center gap-1">
                <span className="min-w-0 flex-1 truncate">
                  {note.text ? (
                    <NoteText note={note} className="whitespace-pre" />
                  ) : (
                    <span className="text-muted-foreground">문구 입력</span>
                  )}
                </span>
                {note.segmentIndex === null &&
                  note.segments.length > 1 &&
                  note.segments.some((segment) => segment.isEcho) && (
                    <span
                      aria-label="에코 포함"
                      className="bg-qwer-r size-1.5 shrink-0 rounded-full"
                    />
                  )}
              </span>
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
      className="pointer-events-none absolute inset-y-0 z-20 w-px bg-cyan-300"
    />
  );
}
