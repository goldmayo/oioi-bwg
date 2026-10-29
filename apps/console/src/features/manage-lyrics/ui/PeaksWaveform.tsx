"use client";

import { useEffect, useRef, useState } from "react";
import type { LyricLine } from "@oioi-bwg/contracts/song";
import type { WaveformData } from "@oioi-bwg/contracts/waveform";
import type { PeaksInstance, Point } from "peaks.js";

import type { YouTubePlayerInstance } from "@/shared/model/youtube";

import { createCuePointMarker } from "../lib/cue-point-marker";
import { createPeaksDisplayData } from "../lib/peaks-display-data";
import { createYouTubePeaksPlayer } from "../lib/youtube-peaks-player";

export interface CuePreview {
  index: number;
  original: number;
  time: number;
}
interface Props {
  data: WaveformData;
  player: YouTubePlayerInstance;
  lyrics: LyricLine[];
  selected: number;
  showCuePoints: boolean;
  seconds: number | "auto";
  follow: boolean;
  navigation: { time: number; revision: number } | null;
  blocked: boolean;
  onTimeUpdate: (time: number) => void;
  onSelect: (index: number) => void;
  onCommit: (index: number, time: number) => void;
  onPreview: (preview: CuePreview | null) => void;
  onError: () => void;
  onZoomChange: (start: number, end: number, minimum: number) => void;
}
/** 브라우저에서만 초기화하며 원본 음원과 Web Audio 분석을 사용하지 않는다. */
export default function PeaksWaveform(props: Props) {
  const overview = useRef<HTMLDivElement>(null);
  const zoomview = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const drag = useRef<{
    point: Point;
    index: number;
    original: number;
    lyrics: LyricLine[];
    cancelled: boolean;
  } | null>(null);
  const [ready, setReady] = useState<{
    data: WaveformData;
    player: YouTubePlayerInstance;
    instance: PeaksInstance;
  } | null>(null);
  const engine =
    ready?.data === props.data && ready.player === props.player ? ready.instance : null;
  useEffect(() => {
    latest.current = props;
  });
  useEffect(() => {
    let disposed = false;
    let instance: PeaksInstance | undefined;
    const display = createPeaksDisplayData(props.data);
    const adapter = createYouTubePeaksPlayer(
      props.player,
      props.data.source.id,
      props.data.durationMs / 1000,
      (time) => latest.current.onTimeUpdate(time),
      () => latest.current.blocked,
    );
    void import("peaks.js")
      .then(({ default: Peaks }) => {
        if (disposed) return;
        Peaks.init(
          {
            overview: {
              container: overview.current,
              enablePoints: false,
              showAxisLabels: false,
              highlightColor: "#c3d3e0",
              highlightOpacity: 0.12,
              highlightStrokeColor: "#afc0d0",
            },
            zoomview: {
              container: zoomview.current,
              autoScroll: true,
              showPlayheadTime: true,
              playheadTextColor: "#eff4f8",
              playheadBackgroundColor: "#3c4652",
            },
            waveformData: { json: display.json },
            player: adapter,
            waveformColor: "#718695",
            playheadColor: "#f0f3f7",
            axisLabelColor: "#b3bfcb",
            axisGridlineColor: "#343d48",
            fontSize: 11,
            pointMarkerColor: "#718695",
            keyboard: false,
            createPointMarker: createCuePointMarker,
          },
          (error, peaks) => {
            if (disposed) {
              peaks?.destroy();
              return;
            }
            if (error || !peaks) {
              adapter.destroy();
              latest.current.onError();
              return;
            }
            instance = peaks;
            peaks.on("zoomview.update", ({ startTime, endTime }) => {
              const width = zoomview.current?.clientWidth ?? 0;
              zoomview.current?.setAttribute("data-start", String(startTime));
              zoomview.current?.setAttribute("data-end", String(endTime));
              latest.current.onZoomChange(
                startTime,
                endTime,
                (width * display.minimumBucketMs) / 1000,
              );
            });
            peaks.on("points.click", ({ point, preventViewEvent }) => {
              preventViewEvent();
              latest.current.onSelect(Number(point.id));
            });
            peaks.on("points.dragstart", ({ point }) => {
              const index = Number(point.id),
                lyrics = latest.current.lyrics;
              if (!lyrics[index]) return;
              drag.current = {
                point,
                index,
                original: lyrics[index].startTime,
                lyrics,
                cancelled: false,
              };
              latest.current.onSelect(index);
            });
            peaks.on("points.dragmove", ({ point }) => {
              const current = drag.current;
              if (!current) return;
              if (
                latest.current.blocked ||
                current.cancelled ||
                current.lyrics !== latest.current.lyrics
              ) {
                point.update({ time: current.original });
                return;
              }
              latest.current.onPreview({
                index: current.index,
                original: current.original,
                time: point.time,
              });
            });
            peaks.on("points.dragend", ({ point }) => {
              const current = drag.current;
              drag.current = null;
              latest.current.onPreview(null);
              if (!current) return;
              const time = Math.max(
                0,
                Math.min(props.data.durationMs / 1000, Math.round(point.time * 100) / 100),
              );
              if (
                latest.current.blocked ||
                current.cancelled ||
                current.lyrics !== latest.current.lyrics ||
                time === current.original
              )
                point.update({ time: current.original });
              else latest.current.onCommit(current.index, time);
            });
            setReady({ data: props.data, player: props.player, instance: peaks });
          },
        );
      })
      .catch(() => {
        if (!disposed) latest.current.onError();
      });
    return () => {
      disposed = true;
      drag.current = null;
      instance?.destroy();
      adapter.destroy();
      latest.current.onPreview(null);
    };
  }, [props.data, props.player]);
  useEffect(() => {
    if (!engine) return;
    if (!props.showCuePoints) {
      for (const point of [...engine.points.getPoints()]) engine.points.removeById(point.id!);
      return;
    }
    const ids = new Set(
      props.lyrics.flatMap((line, index) =>
        line.startTime <= props.data.durationMs / 1000 ? [String(index)] : [],
      ),
    );
    for (const point of engine.points.getPoints())
      if (!ids.has(point.id!)) engine.points.removeById(point.id!);
    props.lyrics.forEach((line, index) => {
      if (line.startTime > props.data.durationMs / 1000) return;
      const options = {
        id: String(index),
        time: line.startTime,
        labelText: `${String(index + 1).padStart(2, "0")} ${line.segments
          .map((s) => s.text)
          .join("")
          .slice(0, 32)}`,
        editable: !props.blocked,
        color: index === props.selected ? "#06bded" : "#718695",
      };
      const point = engine.points.getPoint(options.id);
      if (point) {
        const { time, labelText, editable, color } = options;
        point.update({ time, labelText, editable, color });
      } else engine.points.add(options);
    });
  }, [
    engine,
    props.lyrics,
    props.selected,
    props.blocked,
    props.data.durationMs,
    props.showCuePoints,
  ]);
  useEffect(() => {
    const view = engine?.views.getView("zoomview");
    const factor = props.data.peaks.samples_per_pixel % 4 === 0 ? 4 : 1;
    const minimum =
      ((zoomview.current?.clientWidth ?? 0) * props.data.bucketSizeMs) / factor / 1000;
    view?.setZoom({
      seconds: props.seconds === "auto" ? "auto" : Math.max(minimum, props.seconds),
    });
    view?.enableAutoScroll(props.follow);
    engine?.views.getView("overview")?.enableSeek(!props.blocked);
    view?.enableSeek(!props.blocked);
  }, [
    engine,
    props.seconds,
    props.follow,
    props.blocked,
    props.data.bucketSizeMs,
    props.data.peaks.samples_per_pixel,
  ]);
  useEffect(() => {
    if (props.navigation) engine?.views.getView("zoomview")?.setStartTime(props.navigation.time);
  }, [engine, props.navigation]);
  useEffect(() => {
    if (!engine || !overview.current || !zoomview.current) return;
    const observer = new ResizeObserver(() => {
      engine.views.getView("overview")?.fitToContainer();
      engine.views.getView("zoomview")?.fitToContainer();
    });
    observer.observe(overview.current);
    observer.observe(zoomview.current);
    return () => observer.disconnect();
  }, [engine]);
  useEffect(() => {
    const cancel = (event?: KeyboardEvent) => {
      if (event && event.key !== "Escape") return;
      const current = drag.current;
      if (!current) return;
      event?.preventDefault();
      current.cancelled = true;
      current.point.update({ time: current.original });
      latest.current.onPreview(null);
    };
    window.addEventListener("keydown", cancel, true);
    const cancelOnBlur = () => cancel();
    window.addEventListener("blur", cancelOnBlur);
    return () => {
      window.removeEventListener("keydown", cancel, true);
      window.removeEventListener("blur", cancelOnBlur);
    };
  }, []);
  return (
    <div className="bg-background/50 border-border overflow-hidden border-y">
      <div className="border-border flex items-center border-b py-2">
        <span className="text-muted-foreground w-16 shrink-0 text-center text-xs sm:w-20">
          전체
        </span>
        <div ref={overview} aria-label="전체 파형" className="h-9 min-w-0 flex-1" />
      </div>
      <div className="flex">
        <span className="text-muted-foreground flex w-16 shrink-0 items-center justify-center text-xs sm:w-20">
          파형
        </span>
        <div
          ref={zoomview}
          aria-label="확대 파형과 Cue"
          className="h-32 min-w-0 flex-1 touch-pan-y sm:h-36"
        />
      </div>
    </div>
  );
}
