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
      className="border-border bg-muted/20 flex min-h-16 flex-wrap items-center gap-2 border-y px-4 py-3 text-xs sm:px-6"
    >
      <span className="text-muted-foreground mr-2 min-w-24">
        {notes.length ? `노트 ${notes.length}개 선택` : "노트를 선택하세요"}
      </span>
      <form
        className="flex items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (editableText && text.trim() && !blocked) onEdit({ type: "text", ids, text });
        }}
      >
        <Input
          aria-label="선택 노트 문구"
          className="h-8 w-36 text-xs sm:w-44"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={notes.length === 1 ? notes[0].text || "문구 입력" : "문구 입력"}
          disabled={!editableText || blocked}
        />
        <Button
          size="sm"
          className="bg-cyan-400 text-slate-950 hover:bg-cyan-300"
          type="submit"
          disabled={!editableText || !text.trim() || blocked}
        >
          {notes.length > 1 ? "문구 일괄 적용" : "문구 적용"}
        </Button>
      </form>
      {([-0.01, 0.01] as const).map((delta) => (
        <Button
          key={delta}
          variant="outline"
          size="sm"
          disabled={!ids.length || blocked}
          onClick={() => onEdit({ type: "move", ids, delta, duration })}
        >
          {delta < 0 ? "−10 ms" : "+10 ms"}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        disabled={!extras || ids.length < 2 || sameLine || blocked}
        onClick={() => onEdit({ type: "group", ids })}
      >
        <Link2 size={14} />한 줄로 묶기
      </Button>
      <Button
        variant="ghost"
        size="sm"
        disabled={!sameLine || blocked}
        onClick={() => onEdit({ type: "append", id: ids[0], time: time() })}
      >
        <Plus size={14} />이 줄에 노트 추가
      </Button>
      <Button
        variant="ghost"
        size="icon"
        title="선택 노트 복제"
        aria-label="선택 노트 복제"
        disabled={!ids.length || blocked}
        onClick={() => onEdit({ type: "duplicate", ids, delta: 0.5, duration })}
      >
        <Copy size={15} />
      </Button>
      <Button
        variant="ghost"
        size="icon"
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
