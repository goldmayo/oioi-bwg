"use client";

import { useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import type { LyricLine, PublishedCheerGuide } from "@oioi-bwg/contracts/song";
import { cva } from "class-variance-authority";
import gsap from "gsap";
import { ScrollToPlugin } from "gsap/ScrollToPlugin";
import { Link2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import type { Album } from "@/entities/album";

import { analytics } from "@/shared/lib/analytics";
import { cn } from "@/shared/lib/utils";
import { useAdWatcher } from "@/shared/model/useAdWatcher";
import type { YouTubePlayerInstance } from "@/shared/model/youtube";
import { YouTubePlayer } from "@/shared/ui/YouTubePlayer";

import { usePublishedGuide } from "../model/use-published-guide";

import { CheerGuideInfo } from "./CheerGuideInfo";

import styles from "./lyrics-viewer.module.css";

gsap.registerPlugin(ScrollToPlugin);
const emptyLyrics: LyricLine[] = [];

interface LyricsViewerClientProps {
  song: {
    id: string;
    title: string;
    youtubeId: string;
    lyrics: LyricLine[];
    cheerGuides?: PublishedCheerGuide[];
    hasOfficialCheer?: boolean;
  };
  album?: Album;
}

export function LyricsViewerClient({ song, album }: LyricsViewerClientProps) {
  const [player, setPlayer] = useState<YouTubePlayerInstance | null>(null);
  const { selectedGuide, setGuideId } = usePublishedGuide(song.cheerGuides);
  const lyrics =
    song.cheerGuides === undefined ? song.lyrics : (selectedGuide?.lyrics ?? emptyLyrics);
  const [cursor, setCursor] = useState<{
    lyrics: LyricLine[] | null;
    line: number;
    segment: number;
  }>({ lyrics: null, line: -1, segment: -1 });
  const currentIndex = cursor.lyrics === lyrics ? cursor.line : -1;
  const activeSegmentIndex = cursor.lyrics === lyrics ? cursor.segment : -1;
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // 광고 감시 훅 연동
  const isAdPlaying = useAdWatcher(player, song.youtubeId);

  const handleShare = async () => {
    try {
      const url = new URL(window.location.href);
      if (selectedGuide) url.searchParams.set("guide", selectedGuide.id);
      else url.searchParams.delete("guide");
      await navigator.clipboard.writeText(url.href);
      toast("응원법 링크를 복사했어요.");
    } catch {
      toast.error("링크를 복사하지 못했어요. 다시 시도해 주세요.");
    }
  };

  const handleLyricClick = (line: LyricLine) => {
    player?.seekTo(line.startTime, true);
    if (player && !isAdPlaying) updatePosition(lyrics, line.startTime);
    const fullText = line.segments.map((s) => s.text).join(" ");
    analytics.trackLyricClick(song.title, fullText, line.startTime);
  };

  /**
   * 유튜브 재생 시간 업데이트 콜백
   * 라인 레벨 + isExtra 라인은 세그먼트 레벨까지 추적
   */
  const updatePosition = (lines: LyricLine[], time: number) => {
    const line = lines.findLastIndex((item) => item.startTime <= time);
    const current = lines[line];
    const segment = current?.isExtra
      ? current.segments.findLastIndex(
          (item) => current.startTime + (item.startTimeOffset ?? 0) <= time,
        )
      : -1;
    setCursor((previous) =>
      previous.lyrics === lines && previous.line === line && previous.segment === segment
        ? previous
        : { lyrics: lines, line, segment },
    );
  };
  const handleTimeUpdate = (time: number) => {
    if (!isAdPlaying) updatePosition(lyrics, time);
  };
  const handleGuideChange = (id: string) => {
    const next = song.cheerGuides?.find((guide) => guide.id === id);
    if (!next) return;
    if (!isAdPlaying) updatePosition(next.lyrics, player?.getCurrentTime() ?? 0);
    void setGuideId(id);
  };

  /**
   * 현재 줄을 가사 영역의 가운데에 맞춘다.
   */
  useGSAP(() => {
    if (currentIndex >= 0 && lineRefs.current[currentIndex] && scrollContainerRef.current) {
      const target = lineRefs.current[currentIndex];
      const container = scrollContainerRef.current;

      if (!target || !container) return;

      const bounds = container.getBoundingClientRect();
      const bottomSpace =
        parseFloat(getComputedStyle(container).getPropertyValue("--lyrics-bottom-space")) || 0;
      const visibleTop = Math.max(bounds.top, 0);
      const visibleBottom = Math.min(bounds.bottom, window.innerHeight - bottomSpace);
      const topOffset = Math.max(
        0,
        visibleTop - bounds.top + (visibleBottom - visibleTop - target.offsetHeight) / 2,
      );

      gsap.to(container, {
        scrollTo: {
          y: target,
          offsetY: topOffset,
          autoKill: false,
        },
        duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 0.45,
        ease: "power2.out",
      });
    }
  }, [currentIndex, lyrics]);

  /**
   * isExtra 세그먼트 활성화 시 Pop & Glow 애니메이션
   * className 셀렉터 방식으로 특정 세그먼트 span을 타겟황니다.
   */
  useGSAP(() => {
    if (
      activeSegmentIndex < 0 ||
      currentIndex < 0 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    const selector = `.seg-${currentIndex}-${activeSegmentIndex}`;
    gsap.fromTo(
      selector,
      { scale: 1, y: 0, filter: "brightness(1)" },
      {
        scale: 1.02,
        duration: 0.09,
        yoyo: true,
        repeat: 1,
        ease: "power2.out",
      },
    );
  }, [currentIndex, activeSegmentIndex, lyrics]);

  return (
    <div
      className={cn(
        "dark bg-background text-foreground flex flex-col overflow-x-hidden overflow-y-auto md:flex-row md:overflow-hidden",
        styles.viewer,
      )}
    >
      <section
        aria-label="영상과 곡 정보"
        className="border-border w-full shrink-0 border-b md:h-full md:w-2/5 md:overflow-y-auto md:border-r md:border-b-0"
      >
        <div className="aspect-[4/3] max-h-[32svh] w-full bg-black md:aspect-[5/4] md:max-h-none">
          <YouTubePlayer
            key={song.youtubeId}
            videoId={song.youtubeId}
            posterUrl={album?.imgUrl}
            onTimeUpdate={handleTimeUpdate}
            onPlayerReady={setPlayer}
            className="aspect-auto h-full border-0"
          />
        </div>
        <div className="px-6 pt-5 md:px-8 md:pt-7">
          <div className="mb-5 flex items-end justify-between gap-4 md:mb-6">
            <div className="min-w-0">
              <p className="mb-2 text-sm leading-none md:text-base">QWER</p>
              <h1 className="text-[1.75rem] leading-tight font-bold tracking-tight text-balance break-keep md:text-4xl">
                {song.title}
              </h1>
              {album && (
                <Link
                  href={`/albums/${album.imageSlug}`}
                  className="focus-visible:outline-qwer-w mt-3 block text-base leading-relaxed break-keep whitespace-pre-line hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 md:text-base"
                >
                  {album.name.replace(":", ":\n")}
                </Link>
              )}
            </div>
            <button
              onClick={handleShare}
              className="text-foreground/80 hover:text-foreground focus-visible:outline-qwer-w inline-flex size-11 shrink-0 items-center justify-center rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              aria-label="링크 복사"
              title="링크 복사"
            >
              <Link2 className="size-5" />
            </button>
          </div>
          {selectedGuide && (
            <CheerGuideInfo
              guides={song.cheerGuides ?? []}
              selected={selectedGuide}
              onSelect={handleGuideChange}
            />
          )}
        </div>
      </section>

      {/* 가사 스크롤 영역 */}
      <div
        ref={scrollContainerRef}
        role="region"
        aria-label="응원법 가사"
        tabIndex={0}
        className={cn(
          "focus-visible:outline-qwer-w min-h-48 flex-1 overflow-x-hidden overflow-y-auto px-6 focus-visible:outline-2 focus-visible:outline-offset-[-2px] md:min-h-0 md:px-10",
          styles.lyrics,
        )}
      >
        <div className="mx-auto max-w-3xl pt-4 md:pt-[12vh]">
          {/* 가사 목록 */}
          <div className="space-y-0.5 text-left text-xl leading-relaxed md:space-y-9 md:text-center md:text-3xl">
            {lyrics.map((line, index) => (
              <LyricLineItem
                key={index}
                line={line}
                index={index}
                isActive={index === currentIndex}
                activeSeg={activeSegmentIndex}
                onLineRef={(el) => {
                  lineRefs.current[index] = el;
                }}
                onClick={() => handleLyricClick(line)}
              />
            ))}
            {lyrics.length === 0 && (
              <p className="text-muted-foreground text-base leading-relaxed font-medium">
                아직 공개된 응원법이 없어요.
              </p>
            )}
          </div>

          {/* [Bottom Spacer] 마지막 가사가 중앙에 올 수 있도록 공간 확보 */}
          <div className="h-[50vh]" />
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------------------------
// 로컬 컴포넌트 & CVA (Class Variance Authority) 스타일 정의
// ----------------------------------------------------------------------

const lyricContainerVariants = cva("transition-colors", {
  variants: {
    variant: {
      extra: "inline-flex flex-wrap gap-x-2 font-extrabold",
      normal: "font-bold tracking-tight",
    },
    isActive: {
      true: "",
      false: "",
    },
  },
  compoundVariants: [
    { isActive: true, className: "text-qwer-w" },
    { isActive: false, className: "text-foreground/65" },
  ],
});

const lyricSegmentVariants = cva("transition-colors", {
  variants: {
    variant: {
      extra: "inline-block duration-100",
      normal: "wrap-break-word whitespace-pre-wrap",
    },
    colorState: {
      default: "",
      extraTarget: "underline underline-offset-4",
      extraUntarget: "",
      echo: "decoration-current/35 underline underline-offset-4",
      cheer: "decoration-current/35 underline underline-offset-4",
    },
  },
});

interface LyricLineItemProps {
  line: LyricLine;
  index: number;
  isActive: boolean;
  activeSeg: number;
  onLineRef: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
}

function LyricLineItem({
  line,
  index,
  isActive,
  activeSeg,
  onLineRef,
  onClick,
}: LyricLineItemProps) {
  const variantType = line.isExtra ? "extra" : "normal";
  return (
    <button
      ref={onLineRef}
      type="button"
      onClick={onClick}
      aria-current={isActive ? "true" : undefined}
      className="focus-visible:outline-qwer-w block min-h-9 w-full cursor-pointer rounded-sm py-0.5 text-left transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 md:py-1 md:text-center"
    >
      <span
        className={cn(
          "relative inline-block border-l-4 pl-3 text-balance break-keep transition-colors duration-200 md:pr-3",
          isActive ? "border-qwer-w" : "border-transparent",
          lyricContainerVariants({ variant: variantType, isActive }),
        )}
      >
        {line.segments.map((seg, sIdx) => {
          let colorState: "default" | "extraTarget" | "extraUntarget" | "echo" | "cheer" =
            "default";
          if (line.isExtra) {
            colorState = isActive && sIdx === activeSeg ? "extraTarget" : "extraUntarget";
          } else {
            if (seg.isEcho) colorState = "echo";
            else if (seg.isCheer) colorState = "cheer";
          }

          return (
            <span
              key={sIdx}
              className={cn(
                line.isExtra && `seg-${index}-${sIdx}`,
                lyricSegmentVariants({ variant: variantType, colorState }),
              )}
            >
              {seg.text}
            </span>
          );
        })}
      </span>
    </button>
  );
}
