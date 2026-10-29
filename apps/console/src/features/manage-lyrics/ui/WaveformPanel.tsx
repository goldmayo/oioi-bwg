"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import type { WaveformData } from "@oioi-bwg/contracts/waveform";
import type { UseQueryResult } from "@tanstack/react-query";
import { LocateFixed, Maximize2, Minus, MousePointer2, Pencil, Plus } from "lucide-react";
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
    <div
      role="status"
      className="bg-muted/30 h-28 animate-pulse p-6 text-sm motion-reduce:animate-none"
    >
      파형을 준비하고 있습니다.
    </div>
  );
}
export function WaveformPanel({
  query,
  selectionRevision,
  duration,
  disabled = false,
  selected,
  onSelect,
  onEdit,
  onPreview,
  onCuePreview,
}: PianoRollInteraction & {
  query: UseQueryResult<WaveformData | null>;
  selectionRevision: number;
  duration: number;
  disabled?: boolean;
  onCuePreview: (preview: CuePreview | null) => void;
}) {
  const editor = useLyricsEditorContext();
  const [mode, setMode] = useState<"select" | "draw">("draw");
  const compact = useSyncExternalStore(subscribeCompact, getCompact, getServerCompact);
  const [choice, setChoice] = useState<number | "auto" | null>(null);
  const seconds = choice ?? (compact ? 4 : 8);
  const [zoom, setZoom] = useState({ start: 0, end: 8, minimum: 0 });
  const [follow, setFollow] = useState(true);
  const [navigation, setNavigation] = useState<{ time: number; revision: number } | null>(null);
  const [failedData, setFailedData] = useState<WaveformData | null>(null);
  const data = query.data?.source.id === editor.youtubeId ? query.data : null;
  const failed = query.isError || Boolean(data && failedData === data);
  const canRender = Boolean(data && editor.player && !failed);
  const range =
    !canRender && choice === null
      ? { ...zoom, end: Math.min(duration, zoom.start + (seconds === "auto" ? duration : seconds)) }
      : zoom;
  const setSeconds = (value: number | "auto") => {
    setChoice(value);
    if (!canRender)
      setZoom((previous) => {
        const span = value === "auto" ? duration : value;
        const start = value === "auto" ? 0 : Math.min(previous.start, Math.max(0, duration - span));
        return { ...previous, start, end: Math.min(duration, start + span) };
      });
  };
  const navigate = useCallback(
    (time: number) => {
      setFollow(false);
      setNavigation((previous) => ({ time, revision: (previous?.revision ?? 0) + 1 }));
      if (!canRender)
        setZoom((previous) => ({
          ...previous,
          start: time,
          end: Math.min(duration, time + range.end - range.start),
        }));
    },
    [canRender, duration, range.end, range.start],
  );
  const selectedTime = selected?.time;
  const selectionKey = `${selectionRevision}:${selected?.id}:${selectedTime}`;
  const [lastSelection, setLastSelection] = useState(selectionKey);
  if (lastSelection !== selectionKey) {
    setLastSelection(selectionKey);
    if (selectedTime !== undefined && (selectedTime < range.start || selectedTime >= range.end)) {
      const span = Math.min(duration, range.end - range.start);
      navigate(Math.max(0, Math.min(duration - span, selectedTime - span / 4)));
    }
  }
  const retry = () => {
    setFailedData(null);
    void query.refetch();
  };
  return (
    <section
      className="border-border min-w-0 overflow-hidden border-y"
      aria-labelledby="waveform-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <h2 id="waveform-heading" className="sr-only">
          파형과 노트 타임라인
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === "select" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={mode === "select"}
            disabled={disabled}
            onClick={() => setMode("select")}
          >
            <MousePointer2 size={14} />
            선택
          </Button>
          <Button
            variant={mode === "draw" ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={mode === "draw"}
            disabled={disabled}
            onClick={() => setMode("draw")}
          >
            <Pencil size={14} />
            그리기
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={follow}
            disabled={!canRender}
            onClick={() => setFollow(!follow)}
            className="hidden text-xs sm:inline-flex"
          >
            <LocateFixed size={14} />
            재생 위치 따라가기
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="파형 축소"
            disabled={!canRender}
            onClick={() => setSeconds(Math.min(duration, (range.end - range.start) * 2))}
          >
            <Minus size={15} />
          </Button>
          <span className="text-muted-foreground min-w-10 text-center text-xs tabular-nums">
            {seconds === "auto" ? "전체" : `${Math.round((zoom.end - zoom.start) * 10) / 10}초`}
          </span>
          <Button
            variant="ghost"
            size="icon"
            aria-label="파형 확대"
            disabled={!canRender || zoom.end - zoom.start <= zoom.minimum + 0.05}
            onClick={() => setSeconds(Math.max(0.5, (range.end - range.start) / 2))}
          >
            <Plus size={15} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            aria-label="전체 파형 보기"
            disabled={!canRender}
            onClick={() => setSeconds("auto")}
          >
            <Maximize2 size={14} />
          </Button>
        </div>
      </div>
      {query.isPending ? (
        <WaveformSkeleton />
      ) : failed ? (
        <div className="border-border bg-background/50 flex h-28 flex-col items-center justify-center gap-3 border-y p-5 text-center">
          <p role="alert" className="text-sm">
            파형을 불러오지 못했습니다.
          </p>
          <p className="text-muted-foreground text-xs">
            가사 표와 시간 캡처로 계속 편집할 수 있습니다.
          </p>
          <Button variant="outline" size="sm" onClick={retry}>
            다시 불러오기
          </Button>
        </div>
      ) : data && editor.player ? (
        <PeaksWaveform
          data={data}
          player={editor.player}
          lyrics={editor.lyrics}
          selected={editor.currentIndex}
          showCuePoints={mode === "select"}
          seconds={seconds}
          follow={follow}
          navigation={navigation}
          blocked={disabled || editor.isAdPlaying}
          onTimeUpdate={editor.handleTimeUpdate}
          onSelect={editor.setCurrentIndex}
          onCommit={(index, time) => editor.updateLine(index, { startTime: time })}
          onPreview={onCuePreview}
          onError={() => setFailedData(data)}
          onZoomChange={(start, end, minimum) =>
            setZoom((previous) =>
              Math.abs(previous.start - start) < 0.01 &&
              Math.abs(previous.end - end) < 0.01 &&
              Math.abs(previous.minimum - minimum) < 0.01
                ? previous
                : { start, end, minimum },
            )
          }
        />
      ) : (
        <div className="border-border bg-background/50 flex h-28 flex-col items-center justify-center gap-3 border-y p-5 text-center">
          <p className="text-sm">
            {data
              ? "참고 영상이 준비되면 파형을 표시합니다."
              : query.data
                ? "현재 참고 영상에 맞는 파형이 없습니다."
                : "아직 생성된 파형이 없습니다."}
          </p>
          <p className="text-muted-foreground text-xs">
            가사 표와 시간 캡처로 계속 편집할 수 있습니다.
          </p>
          {!data && (
            <Button variant="outline" size="sm" onClick={retry}>
              파형 다시 확인
            </Button>
          )}
        </div>
      )}
      <PianoRoll
        range={range}
        duration={duration}
        blocked={disabled || editor.isAdPlaying}
        onNavigate={navigate}
        mode={mode}
        selected={selected}
        onSelect={onSelect}
        onEdit={onEdit}
        onPreview={onPreview}
      />
    </section>
  );
}
