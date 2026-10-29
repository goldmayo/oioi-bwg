"use client";

import { useEffect } from "react";
import { Youtube } from "lucide-react";

import { YouTubePlayer } from "@/shared/ui/YouTubePlayer";

import type { SongEditor } from "../model/types";
import type { SaveSongDataAction } from "../model/useAdminEditor";

import { EditorTopBar } from "./EditorTopBar";
import { EditorTransport } from "./EditorTransport";
import { FloatingToolbar } from "./FloatingToolbar";
import { LyricsEditorProvider, useLyricsEditorContext } from "./LyricsEditorContext";
import { LyricsTable } from "./LyricsTable";
import { LyricsTimelinePreview } from "./LyricsTimelinePreview";
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
        void editor.handleSave();
        return;
      }
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('input,textarea,select,[contenteditable="true"],[role="textbox"]')
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
      if (key === "q" && editor.player && editor.lyrics.length)
        editor.captureTime(editor.currentIndex);
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
  }, [disabled, editor]);
  return (
    <div data-lyrics-editor className="bg-background flex h-full min-h-0 flex-col">
      <FloatingToolbar />
      <EditorTopBar />
      <div data-editor-scroll className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 sm:px-6">
        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(280px,0.85fr)_minmax(0,1.65fr)]">
          <section
            className="border-border bg-card grid min-w-0 grid-cols-[1.05fr_1fr] items-center overflow-hidden rounded-xl border lg:block"
            aria-labelledby="reference-video-heading"
          >
            <div className="border-border col-start-2 row-start-1 flex items-center justify-between px-3 py-2 lg:border-b lg:px-4 lg:py-3">
              <h2 id="reference-video-heading" className="text-sm font-medium">
                참고 영상
              </h2>
              <Youtube size={16} className="text-muted-foreground" />
            </div>
            <div className="col-start-1 row-span-2 row-start-1">
              <YouTubePlayer
                key={editor.youtubeId}
                videoId={editor.youtubeId}
                onTimeUpdate={editor.handleTimeUpdate}
                onPlayerReady={editor.setPlayer}
                onStateChange={editor.setPlayerState}
              />
            </div>
            <p className="text-muted-foreground col-start-2 row-start-2 px-3 pb-3 text-xs leading-5 lg:px-4 lg:py-3">
              {editor.isAdPlaying
                ? "광고 재생 중에는 시간 캡처와 파형 탐색을 멈춥니다."
                : "영상 재생 위치와 타임라인을 함께 확인합니다."}
            </p>
          </section>
          <div className="order-3 min-w-0 lg:order-none">
            <LyricsTable />
          </div>
          <div className="order-2 min-w-0 lg:order-none lg:col-span-2">
            <WaveformPanel accountId={accountId} disabled={disabled} />
          </div>
          <section
            className="border-border order-4 min-w-0 border-t pt-3 lg:col-span-2"
            aria-label="실시간 미리보기"
          >
            <h2 className="text-muted-foreground mb-2 text-xs">실시간 미리보기</h2>
            <div className="h-20">
              <LyricsTimelinePreview
                lyrics={editor.lyrics}
                subscribeToTime={editor.subscribeToTime}
              />
            </div>
          </section>
        </div>
      </div>
      <EditorTransport />
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
