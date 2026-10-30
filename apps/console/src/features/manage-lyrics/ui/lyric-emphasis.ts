import type { LyricSegment } from "@oioi-bwg/contracts/song";

/** 사용자 LyricsViewerClient와 같은 우선순위: 추임새 → 에코 → 응원 → 일반. */
export function lyricEmphasisClass(
  segment: Pick<LyricSegment, "isCheer" | "isEcho">,
  isExtra: boolean,
) {
  if (isExtra) return "text-qwer-e";
  if (segment.isEcho) return "text-qwer-r underline underline-offset-4";
  if (segment.isCheer) return "text-qwer-bwg brightness-125 underline underline-offset-4";
  return "text-foreground";
}
