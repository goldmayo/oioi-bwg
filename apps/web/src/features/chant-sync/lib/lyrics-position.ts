import type { LyricLine } from "@oioi-bwg/contracts/song";

/** 행·조각의 배열 위치와 관계없이 가장 최근에 시작한 실제 Cue를 선택한다. */
export function getLyricsPosition(lyrics: LyricLine[], time: number) {
  let latest = -Infinity;
  let line = -1;
  let segment = -1;
  if (!Number.isFinite(time)) return { line, segment };
  lyrics.forEach((item, index) => {
    const count = item.isExtra ? item.segments.length : 1;
    for (let i = 0; i < count; i++) {
      const start = item.startTime + (item.isExtra ? (item.segments[i].startTimeOffset ?? 0) : 0);
      if (start <= time && start >= latest) {
        latest = start;
        line = index;
        segment = item.isExtra ? i : -1;
      }
    }
  });
  return { line, segment };
}
