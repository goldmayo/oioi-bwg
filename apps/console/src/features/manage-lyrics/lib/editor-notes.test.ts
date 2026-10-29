import type { LyricLine } from "@oioi-bwg/contracts/song";
import { lyricsDataSchema } from "@oioi-bwg/contracts/song";
import { describe, expect, it } from "vitest";

import { applyNoteEdit, getEditorNotes } from "./editor-notes";
const fixture: LyricLine[] = [
  {
    startTime: 2,
    isExtra: false,
    segments: [
      { text: "가사", isCheer: false, isEcho: false },
      { text: "응원", isCheer: true, isEcho: false },
    ],
  },
  {
    startTime: 10,
    isExtra: true,
    segments: [0, 0.8, 1.6].map((startTimeOffset) => ({
      text: "어이!",
      isCheer: true,
      isEcho: false,
      startTimeOffset,
    })),
  },
];
describe("응원 노트와 기존 가사 JSON 연결", () => {
  it("혼합 가사는 한 행으로, 추임새는 실제 조각 시각으로 투영한다", () => {
    expect(getEditorNotes(fixture).map(({ lane, time }) => [lane, time])).toEqual([
      ["lyrics", 2],
      ["extra", 10],
      ["extra", 10.8],
      ["extra", 11.6],
    ]);
  });
  it.each(["lyrics", "cheer", "echo", "extra"] as const)(
    "%s 노트를 기존 계약으로 추가하며 원본을 보존한다",
    (lane) => {
      const before = structuredClone(fixture);
      const result = applyNoteEdit(fixture, { type: "add", lane, text: " 새 노트 ", time: 4.125 })!;
      expect(lyricsDataSchema.safeParse(result.lyrics).success).toBe(true);
      expect(result.lyrics[1].startTime).toBe(4.13);
      expect(getEditorNotes(result.lyrics).find(({ id }) => id === result.noteId)?.lane).toBe(lane);
      expect(fixture).toEqual(before);
    },
  );
  it("추임새를 그룹보다 앞으로 옮겨도 다른 조각의 절대 시각과 속성은 보존한다", () => {
    const result = applyNoteEdit(fixture, { type: "move", id: "extra:1:1", time: 8 })!;
    expect(result.lyrics[1].startTime).toBe(8);
    expect(
      getEditorNotes(result.lyrics)
        .filter(({ lane }) => lane === "extra")
        .map(({ time }) => time),
    ).toEqual([10, 8, 11.6]);
    expect(result.lyrics[1].segments.map(({ text, isCheer }) => [text, isCheer])).toEqual([
      ["어이!", true],
      ["어이!", true],
      ["어이!", true],
    ]);
    expect(fixture[1].startTime).toBe(10);
  });
  it("가사 행 이동은 세그먼트 강조/텍스트를 그대로 유지한다", () => {
    const result = applyNoteEdit(fixture, { type: "move", id: "line:0", time: 3 })!;
    expect(result.lyrics[0].segments).toEqual(fixture[0].segments);
    expect(
      applyNoteEdit(fixture, { type: "text", id: "line:0", text: "혼합 덮어쓰기" }),
    ).toBeNull();
  });
  it("추임새 복제는 같은 행에 새 조각 하나만 추가하며, 삭제는 해당 조각만 제거한다", () => {
    const result = applyNoteEdit(fixture, { type: "duplicate", id: "extra:1:1", time: 11.3 })!;
    expect(
      getEditorNotes(result.lyrics)
        .filter(({ lane }) => lane === "extra")
        .map(({ time }) => time),
    ).toEqual([10, 10.8, 11.3, 11.6]);
    const removed = applyNoteEdit(result.lyrics, { type: "delete", id: result.noteId! })!;
    expect(removed.lyrics).toEqual(fixture);
    expect(applyNoteEdit(fixture, { type: "delete", id: "line:0" })!.lyrics).toEqual([fixture[1]]);
  });
  it("마지막 조각 삭제는 빈 노트를 남기지 않고, 단일 가사 복제는 속성을 보존한다", () => {
    const single = [fixture[0]];
    const copied = applyNoteEdit(single, { type: "duplicate", id: "line:0", time: 5 })!;
    expect(copied.lyrics[1].segments).toEqual(single[0].segments);
    expect(
      applyNoteEdit([fixture[1]], { type: "delete", id: "extra:0:0" })!.lyrics[0].segments,
    ).toHaveLength(2);
    const one = [{ ...fixture[1], segments: [fixture[1].segments[0]] }];
    expect(applyNoteEdit(one, { type: "delete", id: "extra:0:0" })!.lyrics).toEqual([]);
  });
  it("비정상 시간·빈 새 노트·오래된 선택·같은 위치 이동을 적용하지 않는다", () => {
    for (const time of [-1, Infinity, NaN])
      expect(applyNoteEdit(fixture, { type: "add", lane: "cheer", time, text: "응원" })).toBeNull();
    expect(applyNoteEdit(fixture, { type: "add", lane: "cheer", time: 1, text: " " })).toBeNull();
    expect(applyNoteEdit(fixture, { type: "move", id: "line:99", time: 1 })).toBeNull();
    expect(applyNoteEdit(fixture, { type: "move", id: "line:0", time: 2 })).toBeNull();
  });
});
