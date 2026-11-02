"use client";

import { lazy, Suspense } from "react";

import type { EditorReturnTarget, SongEditor, WaveformImportControls } from "../model/types";
import type { SaveSongDataAction } from "../model/useAdminEditor";

// React.lazy를 사용한 클라이언트 사이드 지연 로딩
const LyricsEditorClient = lazy(() => import("./LyricsEditorClient"));

interface LazyLyricsEditorProps {
  song: SongEditor;
  saveSongData: SaveSongDataAction;
  accountId: string;
  disabled?: boolean;
  waveformImport?: WaveformImportControls;
  saveLabel?: string;
  referenceVideoReadOnly?: boolean;
  returnTo?: EditorReturnTarget;
}

export function LazyLyricsEditor({
  song,
  saveSongData,
  accountId,
  disabled,
  waveformImport,
  saveLabel,
  referenceVideoReadOnly,
  returnTo,
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
        waveformImport={waveformImport}
        saveLabel={saveLabel}
        referenceVideoReadOnly={referenceVideoReadOnly}
        returnTo={returnTo}
      />
    </Suspense>
  );
}
