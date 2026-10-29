"use client";

import { useId, useState } from "react";

import { Input } from "@/shared/ui/input";

import { formatTime } from "../lib/lrc-parser";

export function NoteTimeInput({
  time,
  duration,
  blocked,
  onCommit,
}: {
  time: number;
  duration: number;
  blocked: boolean;
  onCommit: (time: number) => void;
}) {
  const helpId = useId();
  const [draft, setDraft] = useState<{ source: number; text: string } | null>(null);
  const [invalidAt, setInvalidAt] = useState<number | null>(null);
  const invalid = invalidAt === time;
  return (
    <div>
      <label className="flex flex-col gap-2 text-xs">
        시작 시각
        <Input
          aria-label="노트 시작 시각"
          aria-describedby={helpId}
          aria-invalid={invalid}
          value={draft?.source === time ? draft.text : formatTime(time)}
          disabled={blocked}
          className="font-mono tabular-nums"
          onChange={(event) => {
            setDraft({ source: time, text: event.target.value });
            setInvalidAt(null);
          }}
          onBlur={(event) => {
            const text = event.currentTarget.value.trim();
            const parts = /^(\d+):([0-5]?\d(?:\.\d{1,3})?)$/.exec(text);
            const value = parts
              ? Number(parts[1]) * 60 + Number(parts[2])
              : /^\d+(?:\.\d+)?$/.test(text)
                ? Number(text)
                : NaN;
            setDraft(null);
            const valid = Number.isFinite(value) && value >= 0 && value <= duration;
            setInvalidAt(valid ? null : time);
            if (valid) onCommit(value);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              event.currentTarget.blur();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setDraft(null);
              setInvalidAt(null);
            }
          }}
        />
      </label>
      <p
        id={helpId}
        className="text-muted-foreground mt-2 text-xs leading-5"
        role={invalid ? "alert" : undefined}
      >
        {invalid
          ? `00:00.00부터 ${formatTime(duration)} 사이의 시각을 입력해 주세요.`
          : "분:초.소수 또는 초로 입력 · Enter로 적용"}
      </p>
    </div>
  );
}
