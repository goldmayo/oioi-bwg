import type { LyricLine } from "@oioi-bwg/contracts/song";
import { describe, expect, it } from "vitest";

import { getLyricsPosition } from "./lyrics-position";

const part = (text: string, startTimeOffset?: number) => ({
  text,
  isCheer: true,
  isEcho: false,
  ...(startTimeOffset === undefined ? {} : { startTimeOffset }),
});
const lyrics: LyricLine[] = [
  { startTime: 0.37, isExtra: false, segments: [{ ...part("도입"), isEcho: true }] },
  {
    startTime: 4,
    isExtra: true,
    segments: [part("호출1"), part("호출2", 0.8), part("호출3", 1.6), part("호출4", 2.4)],
  },
  { startTime: 6.65, isExtra: true, segments: [part("다음1"), part("다음2", 0.8)] },
  { startTime: 14.26, isExtra: false, segments: [part("일반 가사")] },
  {
    startTime: 19.75,
    isExtra: false,
    segments: [part("혼합 가사"), { ...part("에코"), isEcho: true }],
  },
];
describe("가사 행과 추임새 조각의 실제 시작 시각", () => {
  it.each([
    [0, -1, -1],
    [0.37, 0, -1],
    [4, 1, 0],
    [4.8, 1, 1],
    [5.6, 1, 2],
    [6.4, 1, 3],
    [6.65, 2, 0],
    [7.45, 2, 1],
    [19.75, 4, -1],
  ])("%s초의 행과 조각", (time, line, segment) => {
    expect(getLyricsPosition(lyrics, time)).toEqual({ line, segment });
  });
  it("노트를 나중으로 옮겨도 뒤쪽 배열 원소가 가로채지 않는다", () => {
    const changed = structuredClone(lyrics);
    changed[1].segments[1].startTimeOffset = 2.5;
    changed[3].startTime = 20;
    expect(getLyricsPosition(changed, 6.51)).toEqual({ line: 1, segment: 1 });
    expect(getLyricsPosition(changed, 20.1)).toEqual({ line: 3, segment: -1 });
  });
  it("다른 추임새 행과 시간이 겹쳐도 가장 최근 Cue를 선택한다", () => {
    const changed = structuredClone(lyrics);
    changed[1].segments[1].startTimeOffset = 2.8;
    expect(getLyricsPosition(changed, 6.81)).toEqual({ line: 1, segment: 1 });
    expect(getLyricsPosition(changed, 7.46)).toEqual({ line: 2, segment: 1 });
  });
  it("행과 조각 배열의 순서를 바꿔도 같은 내용이 활성화되고 입력을 변경하지 않는다", () => {
    for (const rows of [lyrics, [...lyrics].reverse()]) {
      const changed = rows.map((line) => ({
        ...line,
        segments: line.isExtra ? [...line.segments].reverse() : line.segments,
      }));
      const snapshot = structuredClone(changed);
      const position = getLyricsPosition(changed, 5.61);
      expect(changed[position.line].segments[position.segment].text).toBe("호출3");
      expect(changed).toEqual(snapshot);
    }
  });
  it("빈 가사와 유효하지 않은 시각은 활성화하지 않는다", () => {
    expect(getLyricsPosition([], 10)).toEqual({ line: -1, segment: -1 });
    expect(getLyricsPosition(lyrics, NaN)).toEqual({ line: -1, segment: -1 });
  });
});
