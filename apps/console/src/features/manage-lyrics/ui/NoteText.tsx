import { cn } from "@/shared/lib/utils";

import type { EditorNote } from "../lib/editor-notes";

import { lyricEmphasisClass } from "./lyric-emphasis";

export function NoteText({ note, className }: { note: EditorNote; className?: string }) {
  return (
    <>
      {note.segments.map((segment) => (
        <span
          key={segment.segmentIndex}
          data-line={note.lineIndex}
          data-seg={segment.segmentIndex}
          data-is-cheer={segment.isCheer}
          data-is-echo={segment.isEcho}
          className={cn(
            "whitespace-pre-wrap",
            (segment.isCheer || note.segmentIndex !== null) && "font-semibold",
            lyricEmphasisClass(segment, note.segmentIndex !== null),
            className,
          )}
        >
          {segment.text || "빈 내용"}
        </span>
      ))}
    </>
  );
}
export function NoteBadges({ note }: { note: EditorNote }) {
  const cheer = note.segments.some((segment) => segment.isCheer);
  const echo = note.segments.some((segment) => segment.isEcho);
  return (
    <span
      role="group"
      aria-label="노트 강조 속성"
      data-is-cheer={cheer}
      data-is-echo={echo}
      className="flex shrink-0 flex-wrap gap-1 text-xs"
    >
      {note.segmentIndex !== null && (
        <span className="text-qwer-e border-qwer-e/30 rounded border px-1 py-0.5">추가</span>
      )}
      {cheer && (
        <span className="text-qwer-bwg border-qwer-bwg/30 rounded border px-1 py-0.5 brightness-125">
          응원
        </span>
      )}
      {echo && (
        <span className="text-qwer-r border-qwer-r/30 rounded border px-1 py-0.5">에코</span>
      )}
      {!cheer && !echo && <span className="text-muted-foreground">일반</span>}
    </span>
  );
}
