"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/lib/utils";

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
}
export function PianoRoll({
  range,
  duration,
  blocked,
  selectedIds = [],
  onMove,
  loop,
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
  return (
    <section
      id="editor-note-tracks"
      aria-label="가사와 추임새 노트 트랙"
      className="contents"
      data-piano-roll
      data-note-start={range.start}
      data-note-end={range.end}
    >
      <div
        data-note-ruler
        className="col-span-2 row-start-3 grid grid-cols-[var(--editor-gutter)_minmax(0,1fr)]"
      >
        <div aria-hidden="true" />
        <div
          ref={ruler}
          className="relative h-12 touch-none overflow-hidden font-mono text-xs tabular-nums"
          title="시간 눈금"
        >
          {Array.from(
            { length: Math.min(500, Math.ceil((span / step) * 5) + 1) },
            (_, i) => Math.ceil(range.start / (step / 5)) * (step / 5) + (i * step) / 5,
          )
            .filter((time) => time < range.end)
            .map((time) => (
              <span
                key={time}
                aria-hidden="true"
                className="border-border absolute bottom-0 h-2 border-l"
                style={{ left: `${((time - range.start) / span) * 100}%` }}
              />
            ))}
          {ticks.map((time) => (
            <span
              key={time}
              className="text-foreground/90 absolute top-2 whitespace-nowrap"
              style={{ left: `${((time - range.start) / span) * 100}%` }}
            >
              {formatTime(time).slice(0, 5)}
            </span>
          ))}
        </div>
      </div>
      <div
        data-note-lanes
        className="border-border bg-card/10 col-span-2 row-start-5 grid grid-cols-[var(--editor-gutter)_minmax(0,1fr)] border-b"
      >
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
            blocked={blocked}
            preview={drag.preview}
            previewDelta={
              drag.preview
                ? drag.preview.time -
                  (notes.find((n) => n.id === drag.preview?.id)?.time ?? drag.preview.time)
                : 0
            }
            onSelect={onSelect}
            drag={drag}
          />
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-0 col-start-2 row-start-4 row-end-6 overflow-hidden"
        data-timeline-overlay
      >
        {ticks.map((time) => (
          <span
            key={time}
            aria-hidden="true"
            className="border-border absolute inset-y-0 border-l"
            style={{ left: `${((time - range.start) / span) * 100}%` }}
          />
        ))}
        {loop && loop.end > range.start && loop.start < range.end && (
          <div
            className="absolute inset-y-0 border-x border-dashed border-cyan-400/70 bg-cyan-400/10"
            style={{
              left: `${Math.max(0, ((loop.start - range.start) / span) * 100)}%`,
              right: `${Math.max(0, ((range.end - loop.end) / span) * 100)}%`,
            }}
          >
            <span className="bg-cyan-900 px-1 text-[10px] text-cyan-100">A</span>
            <span className="float-right bg-cyan-900 px-1 text-[10px] text-cyan-100">B</span>
          </div>
        )}
        <Playhead range={range} />
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
  blocked,
  preview,
  previewDelta,
  onSelect,
  drag,
}: {
  lane: (typeof lanes)[number];
  notes: EditorNote[];
  selectedIds: string[];
  trackWidth: number;
  range: Props["range"];
  blocked: boolean;
  preview: { id: string; time: number } | null;
  previewDelta: number;
  onSelect: (note: EditorNote, additive?: boolean) => void;
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
      </div>
      <div
        data-note-track={lane.id}
        role="group"
        aria-label={`${lane.label} 노트 트랙`}
        className="border-border relative overflow-x-hidden overflow-y-auto border-t [scrollbar-width:none]"
        style={{ height: lane.id === "extra" ? 128 : 100 }}
      >
        <button
          type="button"
          aria-label={`${lane.label} 트랙 재생 위치 이동`}
          title={`${lane.label} 트랙 재생 위치 이동`}
          disabled={blocked || !editor.player}
          onClick={(event) => {
            const box = event.currentTarget.getBoundingClientRect();
            editor.player?.seekTo(
              event.detail === 0
                ? editor.currentTimeRef.current
                : range.start + ((event.clientX - box.x) / box.width) * span,
              true,
            );
          }}
          className="hover:bg-muted/30 focus-visible:ring-ring absolute inset-0 w-full cursor-crosshair focus-visible:ring-2 focus-visible:ring-inset disabled:cursor-default"
        />
        {ordered.map((note) => {
          const time = timeOf(note);
          if (!Number.isFinite(time) || time < range.start || time >= range.end) return null;
          return (
            <button
              key={note.id}
              type="button"
              data-editor-note={note.id}
              data-note-time={time}
              aria-label={`${lane.label} 노트 ${note.text || "빈 내용"} ${formatTime(time, 3)}`}
              aria-pressed={selectedIds.includes(note.id)}
              disabled={blocked}
              title={`${note.text || "빈 내용"} · ${formatTime(time, 3)}`}
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
                "absolute z-10 h-9 w-max max-w-80 cursor-ew-resize touch-pan-y rounded-md border px-4 text-left text-sm font-medium whitespace-nowrap select-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-200",
                colors[note.lane],
                selectedIds.includes(note.id) && "border-cyan-300 bg-cyan-950/40",
              )}
              style={{
                left: `${((time - range.start) / span) * 100}%`,
                top: (lane.id === "extra" ? 30 : 23) + (rows.get(note.id) ?? 0) * 52,
              }}
            >
              {lane.id === "extra" && (
                <span
                  aria-hidden="true"
                  className="text-foreground/80 absolute -top-6 left-0 flex items-center gap-1 text-[11px] font-normal"
                >
                  <span className="size-2 rounded-full bg-cyan-300" />
                  {formatTime(time, 3)}
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
function Playhead({ range }: { range: Props["range"] }) {
  const { subscribeToTime, currentTimeRef } = useLyricsEditorContext();
  const ref = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLOutputElement>(null);
  useEffect(() => {
    const update = (time: number) => {
      const position = ((time - range.start) / (range.end - range.start)) * 100;
      if (ref.current) {
        ref.current.style.left = `${position}%`;
        ref.current.hidden = position < 0 || position > 100;
      }
      if (label.current) label.current.textContent = formatTime(time, 3);
    };
    update(currentTimeRef.current);
    return subscribeToTime(update);
  }, [range.start, range.end, subscribeToTime, currentTimeRef]);
  return (
    <div ref={ref} data-editor-cti className="absolute inset-y-0 z-20 w-px bg-cyan-300">
      <output
        ref={label}
        aria-label="현재 재생 시각"
        role="timer"
        aria-live="off"
        className="absolute top-2 left-0 rounded-r bg-cyan-300 px-1.5 py-1 font-mono text-[11px] whitespace-nowrap text-cyan-950"
      />
    </div>
  );
}
