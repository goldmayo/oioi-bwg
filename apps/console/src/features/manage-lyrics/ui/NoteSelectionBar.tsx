"use client";

import { useState } from "react";
import { Copy, Link2, Plus, Trash2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";

import type { EditorNote } from "../lib/editor-notes";
import type { SelectionEdit } from "../lib/note-selection";

export function NoteSelectionBar({
  notes,
  blocked,
  duration,
  time,
  onEdit,
}: {
  notes: EditorNote[];
  blocked: boolean;
  duration: number;
  time: () => number;
  onEdit: (edit: SelectionEdit) => void;
}) {
  const [text, setText] = useState(
    notes.length && notes.every((note) => note.text === notes[0].text) ? notes[0].text : "",
  );
  const ids = notes.map((n) => n.id);
  const extras = notes.length > 0 && notes.every((n) => n.lane === "extra");
  const sameLine = extras && notes.every((n) => n.lineIndex === notes[0].lineIndex);
  const editableText =
    notes.length > 0 && notes.every((n) => n.segmentIndex !== null || n.segments.length === 1);
  return (
    <div
      aria-label="선택 노트 편집"
      className="border-border bg-card/40 mx-3 my-3 flex min-h-16 shrink-0 flex-wrap items-center justify-center gap-2 rounded-md border px-4 py-3 text-sm"
    >
      <span className="text-muted-foreground mr-2 min-w-24">
        {notes.length
          ? `${extras ? "추임새" : "노트"} ${notes.length}개 선택`
          : "노트를 선택하세요"}
      </span>
      <form
        className="border-border flex max-w-full flex-wrap items-center gap-2 sm:border-l sm:pl-4"
        onSubmit={(event) => {
          event.preventDefault();
          if (editableText && text.trim() && !blocked) onEdit({ type: "text", ids, text });
        }}
      >
        <label htmlFor="note-selection-text" className="hidden text-sm sm:block">
          문구
        </label>
        <Input
          id="note-selection-text"
          aria-label="선택 노트 문구"
          className="h-9 w-36 text-sm sm:w-40"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={notes.length === 1 ? notes[0].text || "문구 입력" : "문구 입력"}
          disabled={!editableText || blocked}
        />
        <Button
          size="sm"
          className="h-9 min-w-24 bg-cyan-400 px-5 text-slate-950 hover:bg-cyan-300"
          title="선택 노트에 문구 적용"
          type="submit"
          disabled={!editableText || !text.trim() || blocked}
        >
          {notes.length > 1 ? "문구 일괄 적용" : "문구 적용"}
        </Button>
      </form>
      {([-0.01, 0.01] as const).map((delta) => (
        <Button
          key={delta}
          title={`선택 노트 10ms ${delta < 0 ? "앞당기기" : "늦추기"}`}
          variant="outline"
          size="sm"
          className="h-9 min-w-16 bg-white/[0.025]"
          disabled={!ids.length || blocked}
          onClick={() => onEdit({ type: "move", ids, delta, duration })}
        >
          {delta < 0 ? "−10 ms" : "+10 ms"}
        </Button>
      ))}
      {extras && ids.length > 1 && !sameLine && (
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          disabled={blocked}
          title="선택한 추임새를 한 줄로 묶기"
          onClick={() => onEdit({ type: "group", ids })}
        >
          <Link2 size={14} />한 줄로 묶기
        </Button>
      )}
      {sameLine && ids.length === 1 && (
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          disabled={blocked}
          title="이 줄에 노트 추가"
          onClick={() => onEdit({ type: "append", id: ids[0], time: time() })}
        >
          <Plus size={14} />이 줄에 노트 추가
        </Button>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="border-border size-9 border bg-white/[0.025] p-0"
        title="선택 노트 복제"
        aria-label="선택 노트 복제"
        disabled={!ids.length || blocked}
        onClick={() => onEdit({ type: "duplicate", ids, delta: 0.5, duration })}
      >
        <Copy size={15} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="border-border size-9 border bg-white/[0.025] p-0 text-rose-400"
        title="선택 노트 삭제"
        aria-label="선택 노트 삭제"
        disabled={!ids.length || blocked}
        onClick={() => onEdit({ type: "delete", ids })}
      >
        <Trash2 size={15} />
      </Button>
    </div>
  );
}
