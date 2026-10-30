"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { waveformQueries } from "@/entities/waveform";

import { Button } from "@/shared/ui/button";

import { type EditorNote, getEditorNotes, type NoteEdit } from "../lib/editor-notes";
import type { SelectionEdit } from "../lib/note-selection";
import type { SongEditor, WaveformImportControls } from "../model/types";
import type { SaveSongDataAction } from "../model/useAdminEditor";

import { EditorReferenceVideo } from "./EditorReferenceVideo";
import { EditorTopBar } from "./EditorTopBar";
import { FloatingToolbar } from "./FloatingToolbar";
import { LyricsEditorProvider, useLyricsEditorContext } from "./LyricsEditorContext";
import { LyricsTable } from "./LyricsTable";
import { NoteSelectionBar } from "./NoteSelectionBar";
import { WaveformPanel } from "./WaveformPanel";

interface LyricsEditorClientProps {
  song: SongEditor;
  saveSongData: SaveSongDataAction;
  accountId: string;
  disabled?: boolean;
  waveformImport?: WaveformImportControls;
}
function LyricsEditorWorkspace({
  accountId,
  disabled = false,
  waveformImport,
}: {
  accountId: string;
  disabled?: boolean;
  waveformImport?: WaveformImportControls;
}) {
  const editor = useLyricsEditorContext();
  const query = useQuery(waveformQueries.song(accountId, editor.songId));
  const [selection, setSelection] = useState({ ids: [] as string[], signature: "", row: -1 });
  const [loop, setLoop] = useState({ start: 0, end: 8, enabled: false, video: editor.youtubeId });
  const [selectionRevision, setSelectionRevision] = useState(0);
  const signature = JSON.stringify(editor.lyrics);
  const notes = getEditorNotes(editor.lyrics);
  const selectedIds =
    selection.signature === signature && selection.row === editor.currentIndex ? selection.ids : [];
  const selectedNotes = notes.filter((n) => selectedIds.includes(n.id));
  const selected = selectedNotes.at(-1) ?? notes.find((n) => n.lineIndex === editor.currentIndex);
  const waveform = query.data?.source.id === editor.youtubeId ? query.data : null;
  const duration = waveform
    ? waveform.durationMs / 1000
    : Math.max(
        editor.player?.getDuration() || 0,
        ...notes.map((note) => (Number.isFinite(note.time) ? note.time + 8 : 0)),
        30,
      );
  const blocked = disabled || editor.isAdPlaying;
  const looping = loop.enabled && loop.video === editor.youtubeId;
  const select = (note: EditorNote, additive = false) => {
    setSelection({
      ids: additive
        ? selectedIds.includes(note.id)
          ? selectedIds.filter((id) => id !== note.id)
          : [...selectedIds, note.id]
        : selectedIds.includes(note.id)
          ? selectedIds
          : [note.id],
      signature,
      row: note.lineIndex,
    });
    setSelectionRevision((value) => value + 1);
    editor.setCurrentIndex(note.lineIndex);
  };
  const edit = (command: NoteEdit) => {
    if (blocked) return;
    const result = editor.editNote(command);
    if (result) {
      setSelection({
        ids: result.noteId ? [result.noteId] : [],
        signature: JSON.stringify(result.lyrics),
        row: result.lineIndex,
      });
      setSelectionRevision((value) => value + 1);
    }
  };
  const editSelection = (command: SelectionEdit) => {
    if (blocked) return;
    const result = editor.editSelection(command);
    if (result) {
      setSelection({
        ids: result.noteIds,
        signature: JSON.stringify(result.lyrics),
        row: result.lineIndex,
      });
      setSelectionRevision((value) => value + 1);
    }
  };
  const addNote = () =>
    edit({ type: "add", lane: "extra", time: editor.currentTimeRef.current, text: "" });
  const toggleLoop = () =>
    setLoop((previous) => ({ ...previous, enabled: !looping, video: editor.youtubeId }));
  const { subscribeToTime, player, youtubeId } = editor;
  useEffect(() => {
    if (!looping || blocked || !player) return;
    let seeking = false;
    return subscribeToTime((time) => {
      if (seeking) {
        if (time < loop.end) seeking = false;
        return;
      }
      if (player.getPlayerState() === 1 && time >= loop.end) {
        seeking = true;
        player.seekTo(loop.start, true);
      }
    });
  }, [loop, looping, blocked, player, subscribeToTime, youtubeId]);
  const saveLatest = useEffectEvent(() => void editor.handleSave());
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        disabled ||
        event.isComposing ||
        event.defaultPrevented ||
        document.querySelector('[role="dialog"][data-state="open"], dialog[open]')
      )
        return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        // 시간 입력의 blur 변경을 반영한 다음 렌더의 초안을 저장한다.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.setTimeout(() => saveLatest(), 0);
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          'input,textarea,select,[contenteditable="true"],[role="textbox"],[role="checkbox"],[role="combobox"],[role="slider"]',
        )
      )
        return;
      if (event.ctrlKey || event.metaKey) {
        if (event.key.toLowerCase() === "z") {
          event.preventDefault();
          if (event.shiftKey) editor.redo();
          else editor.undo();
        }
        return;
      }
      if (event.altKey || blocked) return;
      const key = event.key.toLowerCase();
      if (key === "escape") {
        setSelection({ ids: [], signature, row: editor.currentIndex });
        return;
      }
      if (event.repeat && (key === "n" || key === "l" || key === " ")) return;
      if (key === "n") {
        event.preventDefault();
        addNote();
      }
      if (key === "l" && player) {
        event.preventDefault();
        toggleLoop();
      }
      if (
        key === " " &&
        player &&
        !(target instanceof Element && target.closest('button,a,summary,[role="button"]'))
      ) {
        event.preventDefault();
        if (player.getPlayerState() === 1) player.pauseVideo();
        else player.playVideo();
      }
      if (selectedIds.length && (key === "arrowleft" || key === "arrowright")) {
        event.preventDefault();
        editSelection({
          type: "move",
          ids: selectedIds,
          delta: (key === "arrowleft" ? -1 : 1) * (event.shiftKey ? 0.1 : 0.01),
          duration,
        });
      }
      if (key === "delete" && selectedIds.length) {
        event.preventDefault();
        editSelection({ type: "delete", ids: selectedIds });
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });
  const loopSettings = looping ? (
    <details className="absolute -top-5 right-2 z-20 text-xs">
      <summary
        className="bg-background/90 border-border cursor-pointer list-none rounded border px-2 py-1"
        title="반복 구간 설정"
      >
        A–B
      </summary>
      <div
        aria-label="반복 구간 설정"
        className="bg-popover border-border absolute top-8 right-0 flex w-64 flex-wrap items-center gap-3 rounded border p-4 shadow-lg"
      >
        <span>반복 구간</span>
        <label>
          A{" "}
          <input
            aria-label="반복 시작 초"
            type="number"
            min="0"
            max={loop.end - 0.1}
            step="0.01"
            className="bg-muted w-24 rounded px-2 py-1"
            value={loop.start}
            onChange={(e) => {
              const start = e.currentTarget.valueAsNumber;
              if (Number.isFinite(start) && start >= 0 && start < loop.end)
                setLoop({ ...loop, start });
            }}
          />
        </label>
        <label>
          B{" "}
          <input
            aria-label="반복 끝 초"
            type="number"
            min={loop.start + 0.1}
            max={duration}
            step="0.01"
            className="bg-muted w-24 rounded px-2 py-1"
            value={loop.end}
            onChange={(e) => {
              const end = e.currentTarget.valueAsNumber;
              if (Number.isFinite(end) && end > loop.start && end <= duration)
                setLoop({ ...loop, end });
            }}
          />
        </label>
        <Button
          variant="ghost"
          size="sm"
          disabled={selectedNotes.length < 2}
          onClick={() =>
            setLoop({
              start: Math.min(...selectedNotes.map((n) => n.time)),
              end: Math.min(duration, Math.max(...selectedNotes.map((n) => n.time)) + 0.5),
              enabled: true,
              video: editor.youtubeId,
            })
          }
        >
          선택 노트 구간 사용
        </Button>
      </div>
    </details>
  ) : null;
  return (
    <div data-lyrics-editor className="bg-background relative flex h-full min-h-0 flex-col">
      <FloatingToolbar />
      <EditorTopBar blocked={blocked} onAdd={addNote} looping={looping} onLoop={toggleLoop} />
      <div
        data-editor-scroll
        className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden"
      >
        <WaveformPanel
          accountId={accountId}
          registration={waveformImport}
          selectionRevision={selectionRevision}
          query={query}
          duration={duration}
          disabled={disabled}
          selected={selected}
          selectedIds={selectedIds}
          loop={looping ? loop : undefined}
          loopSettings={loopSettings}
          onLoopRange={(range) => setLoop({ ...range, enabled: true, video: editor.youtubeId })}
          onSelect={select}
          onEdit={edit}
          onMove={(id, time) => {
            const note = notes.find((n) => n.id === id);
            if (note)
              editSelection({
                type: "move",
                ids: selectedIds.includes(id) ? selectedIds : [id],
                delta: time - note.time,
                duration,
              });
          }}
          onPreview={() => {}}
          onCuePreview={() => {}}
        />
        <NoteSelectionBar
          key={selectedIds.join(",")}
          notes={selectedNotes}
          blocked={blocked}
          duration={duration}
          time={() => editor.currentTimeRef.current}
          onEdit={editSelection}
        />
        <div
          data-editor-dock
          className="grid min-h-72 shrink-0 grid-cols-1 gap-4 px-4 pb-4 lg:min-h-48 lg:flex-1 lg:shrink lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)] lg:gap-0"
        >
          <div className="min-h-0 min-w-0 lg:pr-4">
            <LyricsTable
              selectedLines={selectedNotes.reduce(
                (counts, note) => counts.set(note.lineIndex, (counts.get(note.lineIndex) ?? 0) + 1),
                new Map<number, number>(),
              )}
              onSelectNotes={(index, checked) => {
                const rowIds = notes
                  .filter((note) => note.lineIndex === index)
                  .map((note) => note.id);
                setSelection({
                  ids: checked
                    ? [...new Set([...selectedIds, ...rowIds])]
                    : selectedIds.filter((id) => !rowIds.includes(id)),
                  signature,
                  row: index,
                });
                editor.setCurrentIndex(index);
                setSelectionRevision((value) => value + 1);
              }}
            />
          </div>
          <aside
            aria-label="참고 영상"
            className="border-border min-h-0 min-w-0 border-t pt-3 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-4"
          >
            <EditorReferenceVideo />
          </aside>
        </div>
      </div>
    </div>
  );
}
export default function LyricsEditorClient({
  song,
  saveSongData,
  accountId,
  disabled,
  waveformImport,
}: LyricsEditorClientProps) {
  return (
    <LyricsEditorProvider song={song} saveSongData={saveSongData}>
      <LyricsEditorWorkspace
        accountId={accountId}
        disabled={disabled}
        waveformImport={waveformImport}
      />
    </LyricsEditorProvider>
  );
}
