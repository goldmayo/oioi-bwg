"use client";

import { useState } from "react";
import type { WaveformData } from "@oioi-bwg/contracts/waveform";
import { useQuery } from "@tanstack/react-query";
import { AudioLines, LocateFixed, Maximize2, Minus, Plus, ScanLine } from "lucide-react";
import dynamic from "next/dynamic";

import { waveformQueries } from "@/entities/waveform";

import { Button } from "@/shared/ui/button";

import { formatTime } from "../lib/lrc-parser";

import { useLyricsEditorContext } from "./LyricsEditorContext";
import type { CuePreview } from "./PeaksWaveform";

const PeaksWaveform = dynamic(() => import("./PeaksWaveform"), {
  ssr: false,
  loading: WaveformSkeleton,
});
function WaveformSkeleton() {
  return (
    <div
      role="status"
      className="bg-muted/30 h-64 animate-pulse p-6 text-sm motion-reduce:animate-none"
    >
      파형을 준비하고 있습니다.
    </div>
  );
}
export function WaveformPanel({
  accountId,
  disabled = false,
}: {
  accountId: string;
  disabled?: boolean;
}) {
  const editor = useLyricsEditorContext();
  const query = useQuery(waveformQueries.song(accountId, editor.songId));
  const [seconds, setSeconds] = useState<number | "auto">(16);
  const [zoom, setZoom] = useState({ start: 0, end: 16, minimum: 0 });
  const [follow, setFollow] = useState(true);
  const [preview, setPreview] = useState<CuePreview | null>(null);
  const [failedData, setFailedData] = useState<WaveformData | null>(null);
  const data = query.data?.source.id === editor.youtubeId ? query.data : null;
  const failed = query.isError || Boolean(data && failedData === data);
  const line = editor.lyrics[editor.currentIndex];
  const shownTime = preview?.index === editor.currentIndex ? preview.time : line?.startTime;
  const canRender = Boolean(data && editor.player && !failed);
  const retry = () => {
    setFailedData(null);
    void query.refetch();
  };
  return (
    <section
      className="border-border bg-card overflow-hidden rounded-xl border"
      aria-labelledby="waveform-heading"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h2 id="waveform-heading" className="flex items-center gap-2 text-sm font-semibold">
            <AudioLines size={16} />
            파형 · Cue 타임라인
          </h2>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            포인트를 끌어 가사 시작 시각을 조정합니다.
          </p>
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
            onClick={() =>
              setSeconds((value) =>
                Math.min(data!.durationMs / 1000, (value === "auto" ? 16 : value) * 2),
              )
            }
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
            onClick={() =>
              setSeconds((value) =>
                Math.max(4, (value === "auto" ? data!.durationMs / 1000 : value) / 2),
              )
            }
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
        <div className="border-border bg-background/50 flex h-64 flex-col items-center justify-center gap-3 border-y p-5 text-center">
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
          seconds={seconds}
          follow={follow}
          blocked={disabled || editor.isAdPlaying}
          onTimeUpdate={editor.handleTimeUpdate}
          onSelect={editor.setCurrentIndex}
          onCommit={(index, time) => editor.updateLine(index, { startTime: time })}
          onPreview={setPreview}
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
        <div className="border-border bg-background/50 flex h-52 flex-col items-center justify-center gap-3 border-y p-5 text-center">
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
      {line && (
        <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-3 text-xs">
            <span className="border-qwer-e/40 text-qwer-e rounded border px-1.5 py-1 tabular-nums">
              {String(editor.currentIndex + 1).padStart(2, "0")}
            </span>
            <strong className="max-w-24 truncate font-medium sm:max-w-64">
              {line.segments.map((s) => s.text).join("") || "빈 가사"}
            </strong>
            <span className="text-muted-foreground">시작</span>
            <output
              className="border-border bg-background rounded border px-2 py-1.5 font-mono tabular-nums"
              aria-label="선택한 Cue 시작 시각"
            >
              {formatTime(shownTime ?? 0)}
            </output>
            {preview && (
              <output className="text-qwer-e font-mono">
                {preview.time >= preview.original ? "+" : ""}
                {(preview.time - preview.original).toFixed(2)}s
              </output>
            )}
          </div>
          <div className="flex gap-1.5">
            <Button
              variant="outline"
              size="sm"
              aria-label="선택 행 0.1초 앞당기기"
              onClick={() => editor.applyRowOffset(-0.1)}
              className="h-8 text-xs"
            >
              −0.1s
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-label="선택 행 0.1초 늦추기"
              onClick={() => editor.applyRowOffset(0.1)}
              className="h-8 text-xs"
            >
              +0.1s
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!editor.player || editor.isAdPlaying}
              onClick={() => editor.captureTime(editor.currentIndex)}
              className="h-8 text-xs"
            >
              <ScanLine size={13} />
              시간 캡처<kbd className="text-muted-foreground ml-1">Q</kbd>
            </Button>
          </div>
        </div>
      )}
      <div className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-xs">
        <span>드래그 후 놓으면 한 번에 적용됩니다.</span>
        <span>Esc 이동 취소 · Ctrl Z 실행 취소</span>
      </div>
    </section>
  );
}
