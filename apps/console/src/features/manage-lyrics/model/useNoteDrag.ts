"use client";

import { type PointerEvent, useCallback, useEffect, useRef, useState } from "react";
import type { LyricLine } from "@oioi-bwg/contracts/song";

import type { EditorNote } from "../lib/editor-notes";

export function useNoteDrag({
  lyrics,
  blocked,
  span,
  duration,
  onSelect,
  onCommit,
  onPreview,
}: {
  lyrics: LyricLine[];
  blocked: boolean;
  span: number;
  duration: number;
  onSelect: (note: EditorNote) => void;
  onCommit: (id: string, time: number) => void;
  onPreview: (preview: { id: string; time: number } | null) => void;
}) {
  const [preview, setPreview] = useState<{ id: string; time: number } | null>(null);
  const latest = useRef({ lyrics, blocked, onCommit, onPreview });
  const drag = useRef<{
    id: string;
    original: number;
    time: number;
    x: number;
    width: number;
    lyrics: LyricLine[];
    element: HTMLButtonElement;
    pointer: number;
    moved: boolean;
  } | null>(null);
  useEffect(() => {
    latest.current = { lyrics, blocked, onCommit, onPreview };
  });
  const cancel = useCallback(() => {
    const active = drag.current;
    drag.current = null;
    if (active?.element.hasPointerCapture(active.pointer))
      active.element.releasePointerCapture(active.pointer);
    setPreview(null);
    latest.current.onPreview(null);
  }, []);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !drag.current) return;
      event.preventDefault();
      cancel();
    };
    window.addEventListener("keydown", escape, true);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("blur", cancel);
      const active = drag.current;
      drag.current = null;
      if (active?.element.hasPointerCapture(active.pointer))
        active.element.releasePointerCapture(active.pointer);
    };
  }, [cancel]);
  const onPointerDown = (event: PointerEvent<HTMLButtonElement>, note: EditorNote) => {
    if (blocked || event.button !== 0) return;
    const track = event.currentTarget.closest("[data-note-track]")?.getBoundingClientRect();
    if (!track?.width) return;
    event.stopPropagation();
    event.currentTarget.focus();
    onSelect(note);
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = {
      id: note.id,
      original: note.time,
      time: note.time,
      x: event.clientX,
      width: track.width,
      lyrics,
      element: event.currentTarget,
      pointer: event.pointerId,
      moved: false,
    };
  };
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const active = drag.current;
    if (!active) return;
    if (latest.current.blocked || latest.current.lyrics !== active.lyrics) {
      cancel();
      return;
    }
    if (Math.abs(event.clientX - active.x) < 3 && !active.moved) return;
    active.moved = true;
    active.time =
      Math.round(
        Math.max(
          0,
          Math.min(duration, active.original + ((event.clientX - active.x) / active.width) * span),
        ) * 100,
      ) / 100;
    setPreview({ id: active.id, time: active.time });
    latest.current.onPreview({ id: active.id, time: active.time });
  };
  const onPointerUp = () => {
    const active = drag.current;
    cancel();
    if (
      active?.moved &&
      active.time !== active.original &&
      !latest.current.blocked &&
      latest.current.lyrics === active.lyrics
    )
      latest.current.onCommit(active.id, active.time);
  };
  return { preview, onPointerDown, onPointerMove, onPointerUp, cancel };
}
