"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { WaveformData } from "@oioi-bwg/contracts/waveform";
import type { UseQueryResult } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";
import dynamic from "next/dynamic";

import { Button } from "@/shared/ui/button";

import { useLyricsEditorContext } from "./LyricsEditorContext";
import type { CuePreview } from "./PeaksWaveform";
import { PianoRoll, type PianoRollInteraction } from "./PianoRoll";

const compactQuery = "(max-width: 639px)";
const subscribeCompact = (listener: () => void) => {
  const query = window.matchMedia(compactQuery);
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
};
const getCompact = () => window.matchMedia(compactQuery).matches;
const getServerCompact = () => false;
const PeaksWaveform = dynamic(() => import("./PeaksWaveform"), {
  ssr: false,
  loading: WaveformSkeleton,
});
function WaveformSkeleton() {
  return (
    <div role="status" className="bg-muted/30 col-span-2 row-start-4 h-36 p-6 text-sm">
      waveform을 준비하고 있습니다.
    </div>
  );
}
export function WaveformPanel({
  query,
  selectionRevision,
  duration,
  disabled = false,
  selected,
  selectedIds,
  onMove,
  loop,
  onLoopRange,
  onSelect,
  onEdit,
  onPreview,
  onCuePreview,
  follow,
  onFollow,
}: PianoRollInteraction & {
  query: UseQueryResult<WaveformData | null>;
  selectionRevision: number;
  duration: number;
  disabled?: boolean;
  follow: boolean;
  onFollow: (value: boolean) => void;
  onCuePreview: (preview: CuePreview | null) => void;
}) {
  const editor = useLyricsEditorContext();
  const compact = useSyncExternalStore(subscribeCompact, getCompact, getServerCompact);
  const [choice, setChoice] = useState<number | null>(null);
  const seconds = choice ?? (compact ? 4 : 8);
  const [zoom, setZoom] = useState({ start: 0, end: 8, minimum: 0 });
  const [navigation, setNavigation] = useState<{ time: number; revision: number } | null>(null);
  const [failedData, setFailedData] = useState<WaveformData | null>(null);
  const [loopDrag, setLoopDrag] = useState<{ start: number; end: number } | null>(null);
  const rangeStart = useRef<number | null>(null);
  const host = useRef<HTMLElement>(null);
  const data = query.data?.source.id === editor.youtubeId ? query.data : null;
  const failed = query.isError || Boolean(data && failedData === data);
  const canRender = Boolean(data && editor.player && !failed);
  const range = !canRender ? { ...zoom, end: Math.min(duration, zoom.start + seconds) } : zoom;
  const span = Math.max(0.01, range.end - range.start);
  const blocked = disabled || editor.isAdPlaying;
  const moveView = useCallback(
    (time: number) => {
      const start = Math.max(0, Math.min(Math.max(0, duration - span), time));
      setNavigation((previous) => ({ time: start, revision: (previous?.revision ?? 0) + 1 }));
      if (!canRender)
        setZoom((previous) => ({ ...previous, start, end: Math.min(duration, start + span) }));
    },
    [canRender, duration, span],
  );
  const navigate = useCallback(
    (time: number) => {
      onFollow(false);
      moveView(time);
    },
    [onFollow, moveView],
  );
  const selectedTime = selected?.time;
  const selectionKey = `${selectionRevision}:${selected?.id}:${selectedTime}`;
  const [lastSelection, setLastSelection] = useState(selectionKey);
  if (lastSelection !== selectionKey) {
    setLastSelection(selectionKey);
    if (selectedTime !== undefined && (selectedTime < range.start || selectedTime >= range.end))
      moveView(selectedTime - span / 4);
  }
  useEffect(() => {
    const node = host.current;
    if (!node) return;
    const wheel = (event: WheelEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        (!event.shiftKey && Math.abs(event.deltaX) <= Math.abs(event.deltaY))
      )
        return;
      const width =
        node.querySelector("[data-note-ruler]")?.lastElementChild?.clientWidth ?? node.clientWidth;
      const delta = event.shiftKey ? event.deltaX || event.deltaY : event.deltaX;
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? width : 1;
      event.preventDefault();
      event.stopPropagation();
      navigate(range.start + ((delta * unit) / Math.max(1, width)) * span);
    };
    node.addEventListener("wheel", wheel, { passive: false, capture: true });
    return () => node.removeEventListener("wheel", wheel, true);
  }, [navigate, range.start, span]);
  useEffect(() => {
    const cancel = () => {
      rangeStart.current = null;
      setLoopDrag(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") cancel();
    };
    window.addEventListener("keydown", key, true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", key, true);
      window.removeEventListener("blur", cancel);
    };
  }, []);
  const retry = () => {
    setFailedData(null);
    void query.refetch();
  };
  const point = (element: HTMLElement, x: number) => {
    const box = element.getBoundingClientRect();
    return Math.max(
      range.start,
      Math.min(range.end, range.start + ((x - box.left) / box.width) * span),
    );
  };
  return (
    <section
      ref={host}
      aria-label="waveform과 노트"
      className="relative grid min-w-0 grid-cols-[var(--editor-gutter)_minmax(0,1fr)] [--editor-gutter:64px] sm:[--editor-gutter:80px]"
    >
      <div className="text-muted-foreground col-span-2 row-start-2 flex items-center justify-between gap-2 py-2 text-xs">
        <span>Shift + 휠로 좌우 이동</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="이전 노트 구간"
            aria-label="이전 노트 구간"
            disabled={range.start <= 0}
            onClick={() => navigate(range.start - span / 2)}
          >
            <ChevronLeft size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="waveform 축소"
            aria-label="waveform 축소"
            onClick={() => setChoice(Math.min(duration, span * 2))}
          >
            <Minus size={14} />
          </Button>
          <span className="min-w-10 text-center font-mono tabular-nums">
            {Math.round(span * 10) / 10}초
          </span>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="waveform 확대"
            aria-label="waveform 확대"
            disabled={span <= Math.max(0.5, zoom.minimum) + 0.05}
            onClick={() => setChoice(Math.max(0.5, span / 2))}
          >
            <Plus size={14} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="size-7"
            title="다음 노트 구간"
            aria-label="다음 노트 구간"
            disabled={range.end >= duration}
            onClick={() => navigate(range.start + span / 2)}
          >
            <ChevronRight size={14} />
          </Button>
        </div>
      </div>
      {query.isPending ? (
        <WaveformSkeleton />
      ) : canRender && data && editor.player ? (
        <PeaksWaveform
          data={data}
          player={editor.player}
          lyrics={editor.lyrics}
          selected={editor.currentIndex}
          showCuePoints={false}
          range={range}
          seconds={seconds}
          follow={follow}
          loopMode={Boolean(loop)}
          navigation={navigation}
          blocked={blocked}
          onTimeUpdate={editor.handleTimeUpdate}
          onSelect={editor.setCurrentIndex}
          onCommit={(index, time) => editor.updateLine(index, { startTime: time })}
          onPreview={onCuePreview}
          onError={() => setFailedData(data)}
          onZoomChange={(start, end, minimum) =>
            setZoom((previous) =>
              Math.abs(previous.start - start) < 0.000001 &&
              Math.abs(previous.end - end) < 0.000001 &&
              Math.abs(previous.minimum - minimum) < 0.01
                ? previous
                : { start, end, minimum },
            )
          }
        />
      ) : (
        <div className="border-border bg-card/20 col-span-2 row-start-4 grid h-36 grid-cols-[var(--editor-gutter)_minmax(0,1fr)] border-y">
          <span className="text-muted-foreground flex items-center justify-center text-[10px]">
            waveform
          </span>
          <div className="flex flex-col items-center justify-center gap-3 p-3 text-center text-sm">
            <p role={failed ? "alert" : undefined}>
              {failed
                ? "waveform을 불러오지 못했습니다."
                : data
                  ? "참고 영상이 준비되면 waveform을 표시합니다."
                  : query.data
                    ? "현재 참고 영상에 맞는 waveform이 없습니다."
                    : "등록된 waveform이 없습니다."}
            </p>
            <Button variant="outline" size="sm" title="waveform 다시 확인" onClick={retry}>
              다시 확인
            </Button>
          </div>
        </div>
      )}
      <PianoRoll
        range={range}
        duration={duration}
        blocked={blocked}
        selected={selected}
        selectedIds={selectedIds}
        loop={loopDrag ?? loop}
        onSelect={onSelect}
        onMove={onMove}
        onEdit={onEdit}
        onPreview={onPreview}
      />
      {loop && (
        <div
          aria-label="반복 구간 선택"
          title="waveform을 드래그해 A/B 반복 구간 선택"
          className="absolute inset-0 z-30 col-start-2 row-start-4 cursor-crosshair touch-none"
          onPointerDown={(event) => {
            if (blocked || event.button !== 0) return;
            rangeStart.current = point(event.currentTarget, event.clientX);
            event.currentTarget.setPointerCapture(event.pointerId);
          }}
          onPointerMove={(event) => {
            if (rangeStart.current !== null) {
              const end = point(event.currentTarget, event.clientX);
              setLoopDrag({
                start: Math.min(rangeStart.current, end),
                end: Math.max(rangeStart.current, end),
              });
            }
          }}
          onPointerUp={(event) => {
            const start = rangeStart.current;
            rangeStart.current = null;
            setLoopDrag(null);
            if (start === null || blocked) return;
            const end = point(event.currentTarget, event.clientX);
            if (Math.abs(start - end) >= 0.1)
              onLoopRange?.({
                start: Math.round(Math.min(start, end) * 100) / 100,
                end: Math.round(Math.max(start, end) * 100) / 100,
              });
          }}
          onPointerCancel={() => {
            rangeStart.current = null;
            setLoopDrag(null);
          }}
          onLostPointerCapture={() => {
            rangeStart.current = null;
            setLoopDrag(null);
          }}
        />
      )}
    </section>
  );
}
