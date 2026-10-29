"use client";

import { useCallback, useEffect, useEffectEvent, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { waveformQueries } from "@/entities/waveform";

import { Button } from "@/shared/ui/button";

import { type EditorNote, getEditorNotes, type NoteEdit } from "../lib/editor-notes";
import type { SongEditor } from "../model/types";
import type { SaveSongDataAction } from "../model/useAdminEditor";

import { EditorReferenceVideo } from "./EditorReferenceVideo";
import { EditorTopBar } from "./EditorTopBar";
import { FloatingToolbar } from "./FloatingToolbar";
import { LyricsEditorProvider, useLyricsEditorContext } from "./LyricsEditorContext";
import { LyricsTable } from "./LyricsTable";
import { LyricsTimelinePreview } from "./LyricsTimelinePreview";
import { MobilePaintEditor } from "./MobilePaintEditor";
import { NoteInspector } from "./NoteInspector";
import { NoteTable } from "./NoteTable";
import type { CuePreview } from "./PeaksWaveform";
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ id: string; time: number } | null>(null);
  const [cuePreview, setCuePreview] = useState<CuePreview | null>(null);
  const [focusVersion, setFocusVersion] = useState(0);
  const [selectionRevision, setSelectionRevision] = useState(0);
  const [paintLine, setPaintLine] = useState<number | null>(null);
  const notes = useMemo(() => getEditorNotes(editor.lyrics), [editor.lyrics]);
  const selected =
    notes.find((note) => note.id === selectedId && note.lineIndex === editor.currentIndex) ??
    notes.find((note) => note.lineIndex === editor.currentIndex);
  const waveform = query.data?.source.id === editor.youtubeId ? query.data : null;
  const duration = waveform
    ? waveform.durationMs / 1000
    : Math.max(
        editor.player?.getDuration() || 0,
        ...notes.map((note) => (Number.isFinite(note.time) ? note.time + 8 : 0)),
        30,
      );
  const select = useCallback(
    (note: EditorNote) => {
      setSelectedId(note.id);
      setSelectionRevision((value) => value + 1);
      editor.setCurrentIndex(note.lineIndex);
    },
    [editor],
  );
  const edit = useCallback(
    (command: NoteEdit) => {
      if (disabled || editor.isAdPlaying) return;
      const id = editor.editNote(command);
      if (id !== undefined) {
        setSelectedId(id);
        setSelectionRevision((value) => value + 1);
      }
      if (command.type === "add") setFocusVersion((value) => value + 1);
    },
    [disabled, editor],
  );
  const shownTime =
    selected &&
    (preview?.id === selected.id
      ? preview.time
      : cuePreview?.index === selected.lineIndex
        ? selected.time + cuePreview.time - cuePreview.original
        : selected.time);
  const captureSelected = useCallback(() => {
    if (disabled || editor.isAdPlaying || !editor.player || !selected) return;
    const ordered = [...notes].sort((a, b) => a.time - b.time);
    const next = ordered[ordered.findIndex((note) => note.id === selected.id) + 1];
    edit({ type: "move", id: selected.id, time: editor.currentTimeRef.current });
    if (editor.isRecording && next) select(next);
  }, [disabled, editor, selected, notes, edit, select]);
  const openPaint = (note: EditorNote) => {
    select(note);
    setPaintLine(note.lineIndex);
  };
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
      if (event.altKey || event.shiftKey || editor.isAdPlaying) return;
      const key = event.key.toLowerCase();
      if (!["q", "w", "e", "r"].includes(key)) return;
      event.preventDefault();
      if (key === "q") captureSelected();
      if (key === "w" && editor.player) {
        if (editor.player.getPlayerState() === 1) editor.player.pauseVideo();
        else editor.player.playVideo();
      }
      if (key === "e") {
        editor.addExtraLine(editor.currentIndex);
      }
      if (key === "r") editor.setIsRecording(!editor.isRecording);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [disabled, editor, captureSelected]);
  return (
    <div data-lyrics-editor className="bg-background flex h-full min-h-0 flex-col">
      <FloatingToolbar />
      <EditorTopBar
        selected={selected}
        onSelect={select}
        onCapture={captureSelected}
        blocked={disabled || editor.isAdPlaying}
      />
      <div data-editor-scroll className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid min-w-0 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 p-4 sm:px-6">
            <WaveformPanel
              selectionRevision={selectionRevision}
              query={query}
              duration={duration}
              disabled={disabled}
              selected={selected}
              onSelect={select}
              onEdit={edit}
              onPreview={setPreview}
              onCuePreview={setCuePreview}
            />
            <NoteTable
              selected={selected}
              onSelect={select}
              onEdit={edit}
              onPaint={openPaint}
              blocked={disabled || editor.isAdPlaying}
            />
            <details className="border-border mt-4 border-t pt-3" data-lyric-details>
              <summary className="text-muted-foreground cursor-pointer text-xs">
                가사 강조 · 추임새 세부 편집
              </summary>
              <div className="pt-3">
                <LyricsTable />
              </div>
            </details>
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
            aria-label="영상과 노트 속성"
            className="border-border min-w-0 border-t p-4 lg:border-t-0 lg:border-l"
          >
            <EditorReferenceVideo />
            <NoteInspector
              note={selected}
              shownTime={shownTime}
              duration={duration}
              blocked={disabled || editor.isAdPlaying}
              focusVersion={focusVersion}
              onEdit={edit}
              onCapture={captureSelected}
              onPaint={() => selected && openPaint(selected)}
            />
          </aside>
        </div>
      </div>
      {paintLine !== null && editor.lyrics[paintLine] && (
        <MobilePaintEditor
          line={editor.lyrics[paintLine]}
          lineIndex={paintLine}
          isOpen
          onClose={() => setPaintLine(null)}
        />
      )}
      <footer className="border-border text-muted-foreground flex shrink-0 flex-wrap items-center justify-between gap-2 border-t px-4 py-2 text-xs sm:px-6">
        <span>그리기: 클릭으로 추가 · 선택: 좌우로 이동</span>
        <div className="hidden items-center gap-2 md:flex">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            disabled={disabled || editor.isAdPlaying}
            onClick={() => editor.addExtraLine(editor.currentIndex)}
          >
            <kbd>E</kbd>추임새 추가
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-xs"
            aria-pressed={editor.isRecording}
            disabled={disabled || editor.isAdPlaying}
            onClick={() => editor.setIsRecording(!editor.isRecording)}
          >
            <kbd>R</kbd>연속 캡처 {editor.isRecording ? "켜짐" : "꺼짐"}
          </Button>
        </div>
        <span>Q 캡처 · W 재생 · Esc 이동 취소</span>
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
