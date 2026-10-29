"use client";

import { useState } from "react";
import { Paintbrush, Plus } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import { getEditorNotes } from "../lib/editor-notes";
import { formatTime } from "../lib/lrc-parser";

import { useLyricsEditorContext } from "./LyricsEditorContext";
import { MobilePaintEditor } from "./MobilePaintEditor";
import { NoteBadges, NoteText } from "./NoteText";
import type { PianoRollInteraction } from "./PianoRoll";
export function NoteTable({
  selected,
  onSelect,
  onEdit,
  blocked,
}: Pick<PianoRollInteraction, "selected" | "onSelect" | "onEdit"> & { blocked: boolean }) {
  const editor = useLyricsEditorContext();
  const [paintLine, setPaintLine] = useState<number | null>(null);
  const notes = getEditorNotes(editor.lyrics).sort((a, b) => a.time - b.time);
  return (
    <section aria-labelledby="note-table-heading" className="border-border mt-4 border-t">
      <div className="flex items-center justify-between py-3">
        <h2 id="note-table-heading" className="text-sm font-semibold">
          가사 · 응원{" "}
          <span className="text-muted-foreground ml-2 text-xs font-normal">{notes.length}개</span>
        </h2>
        <Button
          variant="ghost"
          size="sm"
          disabled={blocked}
          onClick={() =>
            onEdit({ type: "add", lane: "extra", time: editor.currentTimeRef.current, text: "" })
          }
        >
          <Plus size={14} />
          노트 추가
        </Button>
      </div>
      <div className="border-border max-h-64 overflow-auto border" data-note-table>
        <table className="w-full border-collapse text-sm">
          <thead className="bg-muted text-muted-foreground sticky top-0 z-10 text-left text-xs">
            <tr>
              <th className="w-12 px-3 py-2 font-normal">선택</th>
              <th className="w-28 px-3 py-2 font-normal">시작</th>
              <th className="px-3 py-2 font-normal">내용</th>
            </tr>
          </thead>
          <tbody>
            {notes.map((note, index) => (
              <tr
                key={note.id}
                className={cn("border-border border-t", selected?.id === note.id && "bg-qwer-e/10")}
              >
                <td className="px-3 py-2">
                  <button
                    aria-label={`${index + 1}번 노트 선택`}
                    aria-pressed={selected?.id === note.id}
                    onClick={() => onSelect(note)}
                    className={cn(
                      "border-border size-6 rounded border text-xs focus-visible:outline-2",
                      selected?.id === note.id && "border-qwer-e text-qwer-e",
                    )}
                  >
                    {index + 1}
                  </button>
                </td>
                <td className="px-3 py-2 font-mono text-xs tabular-nums">
                  <button
                    onClick={() => onSelect(note)}
                    className="rounded focus-visible:outline-2"
                  >
                    {formatTime(note.time)}
                  </button>
                </td>
                <td
                  className="min-w-32 px-3 py-2"
                  data-note-id={note.id}
                  onMouseUp={(event) => editor.handleMouseUpText(event, note.lineIndex)}
                >
                  <div className="flex items-center gap-2">
                    {selected?.id === note.id &&
                    (note.segmentIndex !== null ||
                      editor.lyrics[note.lineIndex].segments.length === 1) ? (
                      <Input
                        aria-label={`${index + 1}번 노트 내용`}
                        value={note.text}
                        disabled={blocked}
                        placeholder="내용을 입력합니다."
                        className={cn(
                          "h-8 min-w-0 flex-1 border-transparent bg-transparent text-sm dark:bg-transparent",
                          note.segments[0]?.isEcho
                            ? "text-qwer-w underline underline-offset-4"
                            : note.segments[0]?.isCheer && "text-qwer-r font-semibold",
                        )}
                        onFocus={() => onSelect(note)}
                        onChange={(event) =>
                          onEdit({ type: "text", id: note.id, text: event.target.value })
                        }
                      />
                    ) : (
                      <button onClick={() => onSelect(note)} className="min-w-0 flex-1 text-left">
                        <NoteText note={note} />
                      </button>
                    )}
                    <NoteBadges note={note} />
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 shrink-0"
                      aria-label={`${index + 1}번 노트 강조 편집`}
                      disabled={blocked}
                      onClick={() => {
                        onSelect(note);
                        setPaintLine(note.lineIndex);
                      }}
                    >
                      <Paintbrush size={13} />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!notes.length && (
          <p className="text-muted-foreground p-6 text-center text-sm">
            그리기로 트랙을 클릭해 첫 노트를 추가합니다.
          </p>
        )}
      </div>
      {editor.lyrics[paintLine ?? 0] && (
        <MobilePaintEditor
          line={editor.lyrics[paintLine ?? 0]}
          lineIndex={paintLine ?? 0}
          isOpen={paintLine !== null}
          onClose={() => setPaintLine(null)}
        />
      )}
    </section>
  );
}
