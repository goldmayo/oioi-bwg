"use client";

import { lazy, Suspense } from "react";

import type { SongEditor, WaveformGenerationControls } from "../model/types";
import type { SaveSongDataAction } from "../model/useAdminEditor";

// React.lazy를 사용한 클라이언트 사이드 지연 로딩
const LyricsEditorClient = lazy(() => import("./LyricsEditorClient"));

interface LazyLyricsEditorProps {
  song: SongEditor;
  saveSongData: SaveSongDataAction;
  accountId: string;
  disabled?: boolean;
  waveformGeneration?: WaveformGenerationControls;
}

export function LazyLyricsEditor({
  song,
  saveSongData,
  accountId,
  disabled,
  waveformGeneration,
}: LazyLyricsEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="bg-background text-muted-foreground flex h-screen items-center justify-center font-bold">
          에디터 로딩 중...
        </div>
      }
    >
      <LyricsEditorClient
        song={song}
        saveSongData={saveSongData}
        accountId={accountId}
        disabled={disabled}
        waveformGeneration={waveformGeneration}
      />
    </Suspense>
  );
}
