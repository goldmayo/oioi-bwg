"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { waveformQueries } from "@/entities/waveform";

import { Button } from "@/shared/ui/button";

import { type EditorNote, getEditorNotes, type NoteEdit } from "../lib/editor-notes";
import type { SelectionEdit } from "../lib/note-selection";
import type { SongEditor } from "../model/types";
import type { SaveSongDataAction } from "../model/useAdminEditor";

import { EditorReferenceVideo } from "./EditorReferenceVideo";
import { EditorTopBar } from "./EditorTopBar";
import { FloatingToolbar } from "./FloatingToolbar";
import { LyricsEditorProvider, useLyricsEditorContext } from "./LyricsEditorContext";
import { LyricsTable } from "./LyricsTable";
import { LyricsTimelinePreview } from "./LyricsTimelinePreview";
import { NoteSelectionBar } from "./NoteSelectionBar";
import { WaveformPanel } from "./WaveformPanel";

interface LyricsEditorClientProps {
  song: SongEditor;
  saveSongData: SaveSongDataAction;
  accountId: string;
  disabled?: boolean;
}
function LyricsEditorWorkspace({
  accountId,
  disabled = false,
}: {
  accountId: string;
  disabled?: boolean;
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
      if (key === " " && player && !(target instanceof Element && target.closest("button,a"))) {
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
  return (
    <div data-lyrics-editor className="bg-background flex h-full min-h-0 flex-col">
      <FloatingToolbar />
      <EditorTopBar blocked={blocked} onAdd={addNote} looping={looping} onLoop={toggleLoop} />
      <div data-editor-scroll className="min-h-0 flex-1 overflow-y-auto">
        <WaveformPanel
          selectionRevision={selectionRevision}
          query={query}
          duration={duration}
          disabled={disabled}
          selected={selected}
          selectedIds={selectedIds}
          loop={looping ? loop : undefined}
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
        {looping && (
          <div
            aria-label="반복 구간 설정"
            className="border-border flex flex-wrap items-center gap-3 border-b px-6 py-2 text-xs"
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
        )}
        <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
          <div className="min-w-0 p-4 sm:px-6">
            <LyricsTable />
            <details className="border-border mt-4 border-t pt-3">
              <summary className="text-muted-foreground cursor-pointer text-xs">
                실시간 응원 미리보기
              </summary>
              <div className="mt-3 h-20">
                <LyricsTimelinePreview
                  lyrics={editor.lyrics}
                  subscribeToTime={editor.subscribeToTime}
                />
              </div>
            </details>
          </div>
          <aside
            aria-label="참고 영상"
            className="border-border min-w-0 border-t p-4 lg:border-t-0 lg:border-l"
          >
            <EditorReferenceVideo />
          </aside>
        </div>
      </div>
      <footer className="border-border text-muted-foreground flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs sm:px-6">
        <span>Space 재생 · N 노트 추가 · Shift/⌘/Ctrl 클릭으로 다중 선택</span>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            disabled={disabled || editor.isAdPlaying}
            onClick={() => editor.captureTime(editor.currentIndex)}
          >
            행 시간 캡처
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            aria-pressed={editor.isRecording}
            disabled={disabled || editor.isAdPlaying}
            onClick={() => editor.setIsRecording(!editor.isRecording)}
          >
            연속 캡처 {editor.isRecording ? "켜짐" : "꺼짐"}
          </Button>
        </div>
        <span>← → 10ms 이동 · Shift 100ms · L 반복</span>
      </footer>
    </div>
  );
}
export default function LyricsEditorClient({
  song,
  saveSongData,
  accountId,
  disabled,
}: LyricsEditorClientProps) {
  return (
    <LyricsEditorProvider song={song} saveSongData={saveSongData}>
      <LyricsEditorWorkspace accountId={accountId} disabled={disabled} />
    </LyricsEditorProvider>
  );
}
