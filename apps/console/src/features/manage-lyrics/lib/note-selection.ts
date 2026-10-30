import type { LyricLine, LyricSegment } from "@oioi-bwg/contracts/song";

import { getEditorNotes } from "./editor-notes";

export type SelectionEdit =
  | { type: "group"; ids: string[] }
  | { type: "move" | "duplicate"; ids: string[]; delta: number; duration: number }
  | { type: "delete"; ids: string[] }
  | { type: "text"; ids: string[]; text: string }
  | { type: "append"; id: string; time: number };
const round = (time: number) => Math.round(time * 1e9) / 1e9;

/** 한 번의 선택 편집을 한 history 항목으로 저장한다. 시간은 절대값으로 계산한 뒤 재기준화한다. */
export function applySelectionEdit(lyrics: LyricLine[], edit: SelectionEdit) {
  const ids = new Set("ids" in edit ? edit.ids : [edit.id]);
  const notes = getEditorNotes(lyrics)
    .filter((note) => ids.has(note.id))
    .map((note) => ({
      ...note,
      // 표시용 10ms 반올림을 원본 시각에 역적용하지 않는다.
      time:
        lyrics[note.lineIndex].startTime +
        (note.segmentIndex === null
          ? 0
          : (lyrics[note.lineIndex].segments[note.segmentIndex].startTimeOffset ?? 0)),
    }));
  if (!notes.length || notes.length !== ids.size) return null;
  const extraOnly = notes.every((note) => note.segmentIndex !== null);
  if ((edit.type === "group" || edit.type === "append") && !extraOnly) return null;
  if (edit.type === "group" && notes.length < 2) return null;
  if (edit.type === "text" && notes.some((n) => n.segmentIndex === null && n.segments.length > 1))
    return null;
  if (edit.type === "text") {
    let changed = false;
    const next = lyrics.map((line, lineIndex) => ({
      ...line,
      segments: line.segments.map((segment, segmentIndex) => {
        const chosen = notes.some(
          (n) =>
            n.lineIndex === lineIndex &&
            (n.segmentIndex === null || n.segmentIndex === segmentIndex),
        );
        if (!chosen || segment.text === edit.text) return segment;
        changed = true;
        return { ...segment, text: edit.text };
      }),
    }));
    return changed ? { lyrics: next, noteIds: [...ids], lineIndex: notes[0].lineIndex } : null;
  }
  if (edit.type === "append" && (!Number.isFinite(edit.time) || edit.time < 0)) return null;
  let delta = 0;
  if (edit.type === "move" || edit.type === "duplicate") {
    if (!Number.isFinite(edit.delta) || !Number.isFinite(edit.duration)) return null;
    delta = round(
      Math.max(
        -Math.min(...notes.map((n) => n.time)),
        Math.min(edit.delta, edit.duration - Math.max(...notes.map((n) => n.time))),
      ),
    );
    if (edit.type === "move" && delta === 0) return null;
  }
  const selectedSegments = new Set<LyricSegment>();
  const selectedLines = new Set<LyricLine>();
  const grouped: { segment: LyricSegment; time: number }[] = [];
  const result: LyricLine[] = [];
  lyrics.forEach((line, lineIndex) => {
    const chosen = notes.filter((n) => n.lineIndex === lineIndex);
    if (!chosen.length) {
      result.push(line);
      return;
    }
    if (!line.isExtra) {
      if (edit.type === "delete") return;
      const copy = {
        ...line,
        segments: line.segments.map((s) => ({ ...s })),
        startTime: round(line.startTime + delta),
      };
      if (edit.type === "duplicate") result.push(line);
      result.push(copy);
      selectedLines.add(copy);
      return;
    }
    const indexes = new Set(chosen.map((n) => n.segmentIndex));
    const chunks: { segment: LyricSegment; time: number }[] = [];
    line.segments.forEach((segment, index) => {
      const time = round(line.startTime + (segment.startTimeOffset ?? 0));
      if (!indexes.has(index)) {
        chunks.push({ segment, time });
        return;
      }
      if (edit.type === "delete") return;
      if (edit.type === "group") {
        grouped.push({ segment: { ...segment }, time });
        return;
      }
      if (edit.type === "duplicate") chunks.push({ segment, time });
      const copy = { ...segment };
      chunks.push({ segment: copy, time: round(time + delta) });
      if (edit.type !== "append") selectedSegments.add(copy);
    });
    if (edit.type === "append") {
      const segment = { text: "", isCheer: true, isEcho: false };
      chunks.push({ segment, time: round(edit.time) });
      selectedSegments.add(segment);
    }
    if (chunks.length) result.push(rebase(line, chunks));
  });
  if (grouped.length) {
    grouped.forEach(({ segment }) => selectedSegments.add(segment));
    result.push(rebase({ isExtra: true, startTime: 0, segments: [] }, grouped));
  }
  result.sort((a, b) => a.startTime - b.startTime);
  const noteIds = getEditorNotes(result)
    .filter((n) =>
      n.segmentIndex === null
        ? selectedLines.has(result[n.lineIndex])
        : selectedSegments.has(result[n.lineIndex].segments[n.segmentIndex]),
    )
    .map((n) => n.id);
  const lineIndex = getEditorNotes(result).find((n) => noteIds.includes(n.id))?.lineIndex ?? 0;
  return { lyrics: result, noteIds, lineIndex };

  function rebase(line: LyricLine, chunks: { segment: LyricSegment; time: number }[]): LyricLine {
    chunks.sort((a, b) => a.time - b.time);
    const startTime = Math.min(...chunks.map((c) => c.time));
    return {
      ...line,
      startTime,
      segments: chunks.map(({ segment, time }) => {
        const copy = { ...segment, startTimeOffset: round(time - startTime) };
        if (selectedSegments.delete(segment)) selectedSegments.add(copy);
        return copy;
      }),
    };
  }
}
