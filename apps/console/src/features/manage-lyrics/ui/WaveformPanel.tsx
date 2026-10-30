"use client";

import { type ReactNode, useCallback, useState, useSyncExternalStore } from "react";
import type { WaveformData } from "@oioi-bwg/contracts/waveform";
import type { UseQueryResult } from "@tanstack/react-query";
import { ListChecks, LocateFixed, Maximize2, Minus, Plus } from "lucide-react";
import dynamic from "next/dynamic";

import { Button } from "@/shared/ui/button";

import type { WaveformGenerationControls } from "../model/types";

import { useLyricsEditorContext } from "./LyricsEditorContext";
import type { CuePreview } from "./PeaksWaveform";
import { PianoRoll, type PianoRollInteraction } from "./PianoRoll";
import { WaveformGenerationButton } from "./WaveformGenerationButton";

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
  accountId,
  generation,
  query,
  selectionRevision,
  duration,
  disabled = false,
  selected,
  selectedIds,
  onMove,
  loop,
  loopSettings,
  onLoopRange,
  onSelect,
  onEdit,
  onPreview,
  onCuePreview,
}: PianoRollInteraction & {
  accountId: string;
  generation?: WaveformGenerationControls;
  query: UseQueryResult<WaveformData | null>;
  loopSettings?: ReactNode;
  selectionRevision: number;
  duration: number;
  disabled?: boolean;
  onCuePreview: (preview: CuePreview | null) => void;
}) {
  const editor = useLyricsEditorContext();
  const [multiple, setMultiple] = useState(false);
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
    <>
      {generation ? (
        <div className="mx-4 mt-4">
          <WaveformGenerationButton
            accountId={accountId}
            songId={editor.songId}
            disabled={disabled || editor.isSaving}
            videoChanged={editor.isVideoDirty || editor.youtubeId !== generation.videoId}
            onError={generation.onError}
          />
        </div>
      ) : null}
      <section
        className="group/waveform relative mx-4 mt-5 flex min-w-0 shrink-0 flex-col"
        aria-labelledby="waveform-heading"
      >
        {loopSettings}
        <div className="bg-background/95 border-border absolute top-2 right-2 z-20 flex items-center gap-1 rounded border opacity-100 transition-opacity group-hover/waveform:opacity-100 focus-within:opacity-100 sm:opacity-0">
          <h2 id="waveform-heading" className="sr-only">
            파형 · 노트
          </h2>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              aria-label="여러 노트 선택"
              title="여러 노트 선택"
              aria-pressed={multiple}
              onClick={() => setMultiple(!multiple)}
              className={multiple ? "text-cyan-300" : ""}
            >
              <ListChecks size={16} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              title="재생 위치 따라가기"
              aria-label="재생 위치 따라가기"
              aria-pressed={follow}
              disabled={!canRender}
              onClick={() => setFollow(!follow)}
              className={follow ? "text-cyan-300" : ""}
            >
              <LocateFixed size={14} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="파형 축소"
              onClick={() => setSeconds(Math.min(duration, (range.end - range.start) * 2))}
            >
              <Minus size={15} />
            </Button>
            <span className="text-muted-foreground hidden min-w-10 text-center text-xs tabular-nums sm:block">
              {seconds === "auto" ? "전체" : `${Math.round((zoom.end - zoom.start) * 10) / 10}초`}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="파형 확대"
              disabled={range.end - range.start <= Math.max(0.5, zoom.minimum) + 0.05}
              onClick={() => setSeconds(Math.max(0.5, (range.end - range.start) / 2))}
            >
              <Plus size={15} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="전체 파형 보기"
              onClick={() => setSeconds("auto")}
            >
              <Maximize2 size={14} />
            </Button>
          </div>
        </div>
        {query.isPending ? (
          <WaveformSkeleton />
        ) : failed ? (
          <div className="border-border bg-background/50 order-3 flex h-36 flex-col items-center justify-center gap-3 border-y p-5 text-center">
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
            showCuePoints={false}
            loop={loop}
            range={range}
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
          <div className="border-border bg-background/50 order-3 flex h-36 flex-col items-center justify-center gap-3 border-y p-5 text-center">
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
          mode="draw"
          selected={selected}
          selectedIds={selectedIds}
          loop={loop}
          onLoopRange={onLoopRange}
          onSelect={(note, additive) => onSelect(note, additive || multiple)}
          onMove={onMove}
          onEdit={onEdit}
          onPreview={onPreview}
        />
      </section>
    </>
  );
}
