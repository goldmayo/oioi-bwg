import type { LyricLine, LyricSegment } from "@oioi-bwg/contracts/song";

export type NoteLane = "lyrics" | "cheer" | "echo" | "extra";
export interface EditorNote {
  id: string;
  lineIndex: number;
  segmentIndex: number | null;
  lane: NoteLane;
  text: string;
  time: number;
  segments: (LyricSegment & { segmentIndex: number })[];
}
export type NoteEdit =
  | { type: "add"; lane: NoteLane; time: number; text: string }
  | { type: "move"; id: string; time: number }
  | { type: "text"; id: string; text: string }
  | {
      type: "segment";
      id: string;
      segmentIndex: number;
      value: Partial<Pick<LyricSegment, "text" | "isCheer" | "isEcho">>;
    }
  | { type: "duplicate"; id: string; time: number }
  | { type: "delete"; id: string };
const round = (time: number) => Math.round(time * 100) / 100;
const idFor = (line: number, segment: number | null) =>
  segment === null ? `line:${line}` : `extra:${line}:${segment}`;

/** 가사 행과 추임새 조각을 기존 JSON에서 읽는 편집용 projection이다. */
export function getEditorNotes(lyrics: LyricLine[]): EditorNote[] {
  return lyrics.flatMap<EditorNote>((line, lineIndex) => {
    if (line.isExtra)
      return line.segments.map((segment, segmentIndex) => ({
        id: idFor(lineIndex, segmentIndex),
        lineIndex,
        segmentIndex,
        lane: "extra" as const,
        segments: [{ ...segment, segmentIndex }],
        text: segment.text,
        time: round(line.startTime + (segment.startTimeOffset ?? 0)),
      }));
    const lane =
      line.segments.length && line.segments.every((segment) => segment.isEcho)
        ? "echo"
        : line.segments.length &&
            line.segments.every((segment) => segment.isCheer && !segment.isEcho)
          ? "cheer"
          : "lyrics";
    return [
      {
        id: idFor(lineIndex, null),
        lineIndex,
        segmentIndex: null,
        lane,
        segments: line.segments.map((segment, segmentIndex) => ({ ...segment, segmentIndex })),
        text: line.segments.map((segment) => segment.text).join(""),
        time: line.startTime,
      },
    ];
  });
}

/** 각 결과는 초안/history에 한 번만 반영한다. 노트의 표시 폭은 저장하지 않는다. */
export function applyNoteEdit(
  lyrics: LyricLine[],
  edit: NoteEdit,
): {
  lyrics: LyricLine[];
  noteId: string | null;
  lineIndex: number;
} | null {
  if ("time" in edit && (!Number.isFinite(edit.time) || edit.time < 0)) return null;
  if (edit.type === "add") {
    const text = edit.text.trim();
    const line: LyricLine = {
      startTime: round(edit.time),
      isExtra: edit.lane === "extra",
      segments: [
        {
          text,
          isCheer: edit.lane === "cheer" || edit.lane === "extra",
          isEcho: edit.lane === "echo",
          ...(edit.lane === "extra" ? { startTimeOffset: 0 } : {}),
        },
      ],
    };
    const next = [...lyrics, line].sort((a, b) => a.startTime - b.startTime);
    const lineIndex = next.indexOf(line);
    return { lyrics: next, lineIndex, noteId: idFor(lineIndex, line.isExtra ? 0 : null) };
  }
  const note = getEditorNotes(lyrics).find((value) => value.id === edit.id);
  if (!note) return null;
  const line = lyrics[note.lineIndex];
  const next = [...lyrics];
  const segmentIndex = note.segmentIndex;
  if (edit.type === "delete") {
    if (segmentIndex === null || line.segments.length === 1) next.splice(note.lineIndex, 1);
    else
      next[note.lineIndex] = {
        ...line,
        segments: line.segments.filter((_, i) => i !== segmentIndex),
      };
    const lineIndex = Math.max(0, Math.min(note.lineIndex, next.length - 1));
    const selected = getEditorNotes(next).find((value) => value.lineIndex === lineIndex);
    return { lyrics: next, lineIndex, noteId: selected?.id ?? null };
  }
  if (edit.type === "segment") {
    const segment = line.segments[edit.segmentIndex];
    if (!segment || (segmentIndex !== null && segmentIndex !== edit.segmentIndex)) return null;
    if (
      Object.entries(edit.value).every(
        ([key, value]) => segment[key as keyof LyricSegment] === value,
      )
    )
      return null;
    next[note.lineIndex] = {
      ...line,
      segments: line.segments.map((value, index) =>
        index === edit.segmentIndex ? { ...value, ...edit.value } : value,
      ),
    };
  } else if (edit.type === "text") {
    if (segmentIndex === null && line.segments.length !== 1) return null;
    const index = segmentIndex ?? 0;
    if (line.segments[index].text === edit.text) return null;
    next[note.lineIndex] = {
      ...line,
      segments: line.segments.map((value, i) =>
        i === index ? { ...value, text: edit.text } : value,
      ),
    };
  } else if (edit.type === "duplicate" && segmentIndex === null) {
    const copy = {
      ...line,
      startTime: round(edit.time),
      segments: line.segments.map((value) => ({ ...value })),
    };
    next.push(copy);
    next.sort((a, b) => a.startTime - b.startTime);
    const lineIndex = next.indexOf(copy);
    return { lyrics: next, lineIndex, noteId: idFor(lineIndex, null) };
  } else if (segmentIndex !== null) {
    if (edit.type === "move" && round(edit.time) === round(note.time)) return null;
    const times = line.segments.map((value) => line.startTime + (value.startTimeOffset ?? 0));
    const segments = line.segments.map((value) => ({ ...value }));
    let selected = segmentIndex;
    if (edit.type === "duplicate") {
      selected = segmentIndex + 1;
      segments.splice(selected, 0, { ...segments[segmentIndex] });
      times.splice(selected, 0, round(edit.time));
    } else times[segmentIndex] = round(edit.time);
    const startTime = Math.min(...times);
    next[note.lineIndex] = {
      ...line,
      startTime,
      segments: segments.map((value, i) => ({
        ...value,
        startTimeOffset: round(times[i] - startTime),
      })),
    };
    return { lyrics: next, lineIndex: note.lineIndex, noteId: idFor(note.lineIndex, selected) };
  } else {
    if (round(edit.time) === round(note.time)) return null;
    next[note.lineIndex] = { ...line, startTime: round(edit.time) };
  }
  return { lyrics: next, lineIndex: note.lineIndex, noteId: note.id };
}
