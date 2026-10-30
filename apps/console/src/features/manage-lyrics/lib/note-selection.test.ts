import type { LyricLine } from "@oioi-bwg/contracts/song";
import { describe, expect, it } from "vitest";

import { getEditorNotes } from "./editor-notes";
import { applySelectionEdit } from "./note-selection";

const extra = (time: number, text: string, echo = false): LyricLine => ({
  startTime: time,
  isExtra: true,
  segments: [{ text, isCheer: true, isEcho: echo, startTimeOffset: 0 }],
});
const source = [
  extra(4, "어이!"),
  extra(4.8, "어이!", true),
  extra(5.6, "어이!"),
  extra(6.4, "어이!"),
];
describe("노트 선택 편집", () => {
  it("네 노트를 한 줄로 묶되 공개 청크 시각과 강조를 보존한다", () => {
    const grouped = applySelectionEdit(source, {
      type: "group",
      ids: getEditorNotes(source).map((n) => n.id),
    })!;
    expect(grouped.lyrics).toHaveLength(1);
    expect(grouped.lyrics[0].segments.map((s) => s.startTimeOffset)).toEqual([0, 0.8, 1.6, 2.4]);
    expect(grouped.lyrics[0].segments[1].isEcho).toBe(true);
    expect(grouped.noteIds).toHaveLength(4);
    expect(source).toEqual([
      extra(4, "어이!"),
      extra(4.8, "어이!", true),
      extra(5.6, "어이!"),
      extra(6.4, "어이!"),
    ]);
  });
  it("일부 청크만 묶고 남은 청크의 절대 시각과 속성을 유지한다", () => {
    const initial = [
      {
        ...extra(4, "A"),
        segments: [
          ...extra(4, "A").segments,
          { text: "B", isEcho: true, isCheer: true, startTimeOffset: 2 },
        ],
      },
      extra(7, "C"),
    ];
    const result = applySelectionEdit(initial, { type: "group", ids: ["extra:0:0", "extra:1:0"] })!;
    expect(getEditorNotes(result.lyrics).map((n) => [n.text, n.time])).toEqual([
      ["A", 4],
      ["C", 7],
      ["B", 6],
    ]);
    expect(result.lyrics[1].segments[0]).toEqual({
      text: "B",
      isEcho: true,
      isCheer: true,
      startTimeOffset: 0,
    });
  });
  it("묶기와 미세 이동은 원본의 밀리초 시각을 표시 정밀도로 반올림하지 않는다", () => {
    const input = [
      {
        ...extra(1.001, "A"),
        segments: [{ ...extra(0, "A").segments[0], startTimeOffset: 0.123 }],
      },
      extra(2.005, "B"),
    ];
    const grouped = applySelectionEdit(input, { type: "group", ids: ["extra:0:0", "extra:1:0"] })!;
    expect(grouped.lyrics[0].startTime).toBe(1.124);
    expect(grouped.lyrics[0].segments[1].startTimeOffset).toBe(0.881);
    const moved = applySelectionEdit(grouped.lyrics, {
      type: "move",
      ids: grouped.noteIds,
      delta: 0.01,
      duration: 20,
    })!;
    expect(moved.lyrics[0].startTime).toBe(1.134);
    expect(moved.lyrics[0].segments[1].startTimeOffset).toBe(0.881);
  });
  it("다중 이동의 경계에서도 노트 간격을 보존한다", () => {
    const result = applySelectionEdit(source, {
      type: "move",
      ids: ["extra:0:0", "extra:1:0"],
      delta: -10,
      duration: 20,
    })!;
    expect(getEditorNotes(result.lyrics).map((n) => n.time)).toEqual([0, 0.8, 5.6, 6.4]);
    const end = applySelectionEdit(source, {
      type: "move",
      ids: ["extra:0:0", "extra:1:0"],
      delta: 100,
      duration: 8,
    })!;
    expect(
      getEditorNotes(end.lyrics)
        .filter((n) => end.noteIds.includes(n.id))
        .map((n) => n.time),
    ).toEqual([7.2, 8]);
  });
  it("복제와 문구 일괄 변경은 선택한 청크만 변경한다", () => {
    const line = {
      ...extra(4, "A"),
      segments: [
        ...extra(4, "A").segments,
        { ...extra(4, "B", true).segments[0], startTimeOffset: 1 },
      ],
    };
    const copy = applySelectionEdit([line], {
      type: "duplicate",
      ids: ["extra:0:1"],
      delta: 1,
      duration: 20,
    })!;
    expect(getEditorNotes(copy.lyrics).map((n) => [n.text, n.time])).toEqual([
      ["A", 4],
      ["B", 5],
      ["B", 6],
    ]);
    const text = applySelectionEdit(copy.lyrics, { type: "text", ids: copy.noteIds, text: "C" })!;
    expect(text.lyrics[0].segments.map((s) => [s.text, s.isEcho])).toEqual([
      ["A", false],
      ["B", true],
      ["C", true],
    ]);
  });
  it("기존 줄보다 앞에 추가해도 이전 청크의 시각을 바꾸지 않는다", () => {
    const appended = applySelectionEdit([extra(4, "A", true)], {
      type: "append",
      id: "extra:0:0",
      time: 2,
    })!;
    expect(appended.lyrics[0].startTime).toBe(2);
    expect(getEditorNotes(appended.lyrics).map((n) => [n.text, n.time])).toEqual([
      ["", 2],
      ["A", 4],
    ]);
    expect(appended.noteIds).toEqual(["extra:0:0"]);
    expect(appended.lyrics[0].segments[1].isEcho).toBe(true);
  });
  it("삭제 후 빈 부모를 제거하고 일반 가사 청크를 묶거나 덮어쓰지 않는다", () => {
    expect(
      applySelectionEdit(source, { type: "delete", ids: getEditorNotes(source).map((n) => n.id) })!
        .lyrics,
    ).toEqual([]);
    const normal = {
      ...source[0],
      isExtra: false,
      segments: [...source[0].segments, ...source[1].segments],
    };
    expect(
      applySelectionEdit([normal], { type: "text", ids: ["line:0"], text: "collapse" }),
    ).toBeNull();
    expect(
      applySelectionEdit([normal, source[1]], { type: "group", ids: ["line:0", "extra:1:0"] }),
    ).toBeNull();
  });
});
