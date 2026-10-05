"use client";

import { lazy, Suspense } from "react";

import type { SongEditor } from "../model/types";
import type { SaveSongDataAction } from "../model/useAdminEditor";

// React.lazy를 사용한 클라이언트 사이드 지연 로딩
const LyricsEditorClient = lazy(() => import("./LyricsEditorClient"));

interface LazyLyricsEditorProps {
  song: SongEditor;
  saveSongData: SaveSongDataAction;
}

export function LazyLyricsEditor({ song, saveSongData }: LazyLyricsEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="bg-background text-muted-foreground flex h-screen items-center justify-center font-bold">
          에디터 로딩 중...
        </div>
      }
    >
      <LyricsEditorClient song={song} saveSongData={saveSongData} />
    </Suspense>
  );
}
