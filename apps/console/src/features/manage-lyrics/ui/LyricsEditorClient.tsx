"use client";

import { useEffect, useEffectEvent, useState } from "react";
import { useQuery } from "@tanstack/react-query";

import { waveformQueries } from "@/entities/waveform";

import { type EditorNote, getEditorNotes, type NoteEdit } from "../lib/editor-notes";
import type { SelectionEdit } from "../lib/note-selection";
import type { SongEditor, WaveformImportControls } from "../model/types";
import type { SaveSongDataAction } from "../model/useAdminEditor";

import { EditorControlPanel } from "./EditorControlPanel";
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
  const [tab, setTab] = useState("timing");
  const [follow, setFollow] = useState(true);
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
  return (
    <div data-lyrics-editor className="bg-background relative flex h-full min-h-0 flex-col">
      <FloatingToolbar />
      <EditorTopBar blocked={blocked} />
      <div
        data-editor-scroll
        className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden"
      >
        <EditorControlPanel
          accountId={accountId}
          registration={waveformImport}
          blocked={blocked}
          follow={follow}
          onFollow={() => setFollow((value) => !value)}
          looping={looping}
          loop={loop}
          duration={duration}
          onLoop={toggleLoop}
          onRange={(range) => setLoop({ ...range, enabled: true, video: editor.youtubeId })}
          onAdd={addNote}
        />
        <div className="grid min-h-0 flex-none grid-cols-1 gap-4 p-4 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_280px] xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="border-border bg-card/20 flex h-[860px] min-h-0 min-w-0 flex-col rounded-md border lg:h-auto">
            <div
              role="tablist"
              aria-label="편집 보기"
              className="border-border flex h-12 shrink-0 gap-5 border-b px-4"
            >
              {[
                ["timing", "타이밍"],
                ["lyrics", "가사"],
              ].map(([id, label]) => (
                <button
                  key={id}
                  id={`tab-${id}`}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  aria-controls={`panel-${id}`}
                  tabIndex={tab === id ? 0 : -1}
                  title={`${label} 보기`}
                  className={`border-b-2 px-1 text-sm ${tab === id ? "border-cyan-400 text-cyan-300" : "text-muted-foreground border-transparent"}`}
                  onClick={() => setTab(id)}
                  onKeyDown={(event) => {
                    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) {
                      event.preventDefault();
                      const next =
                        event.key === "Home"
                          ? "timing"
                          : event.key === "End"
                            ? "lyrics"
                            : id === "timing"
                              ? "lyrics"
                              : "timing";
                      setTab(next);
                      document.getElementById(`tab-${next}`)?.focus();
                    }
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <div
              id="panel-timing"
              role="tabpanel"
              aria-labelledby="tab-timing"
              hidden={tab !== "timing"}
              className={`min-h-0 flex-1 overflow-y-auto p-3 ${tab !== "timing" ? "hidden" : ""}`}
            >
              <WaveformPanel
                selectionRevision={selectionRevision}
                query={query}
                duration={duration}
                disabled={disabled}
                selected={selected}
                selectedIds={selectedIds}
                loop={looping ? loop : undefined}
                follow={follow}
                onFollow={setFollow}
                onLoopRange={(range) =>
                  setLoop({ ...range, enabled: true, video: editor.youtubeId })
                }
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
              <p className="text-muted-foreground pt-3 text-xs">
                Shift/Ctrl/Cmd 클릭으로 여러 노트 선택
              </p>
            </div>
            <div
              id="panel-lyrics"
              role="tabpanel"
              aria-labelledby="tab-lyrics"
              hidden={tab !== "lyrics"}
              className={`min-h-0 flex-1 overflow-hidden p-3 ${tab !== "lyrics" ? "hidden" : ""}`}
            >
              <LyricsTable
                selectedLines={selectedNotes.reduce(
                  (counts, note) =>
                    counts.set(note.lineIndex, (counts.get(note.lineIndex) ?? 0) + 1),
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
            <NoteSelectionBar
              key={selectedIds.join(",")}
              notes={selectedNotes}
              blocked={blocked}
              duration={duration}
              time={() => editor.currentTimeRef.current}
              onEdit={editSelection}
            />
          </section>
          <aside
            aria-label="참고 영상"
            className="border-border bg-card/20 min-h-0 min-w-0 rounded-md border p-3 lg:overflow-y-auto"
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
