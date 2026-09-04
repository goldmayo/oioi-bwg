"use client";

import { createContext, useContext } from "react";

import type { SongEditor } from "../model/types";
import { AdminEditorStore, SaveSongDataAction, useAdminEditor } from "../model/useAdminEditor";

/**
 * LyricsEditor 전역 Context.
 * 하위 컴포넌트들은 useLyricsEditorContext()로 필요한 값만 꺼내 씁니다.
 * prop drilling 없이 useAdminEditor의 모든 값에 접근할 수 있습니다.
 */
const LyricsEditorContext = createContext<AdminEditorStore | null>(null);

/**
 * 가사 편집 로직(useAdminEditor)을 Context로 감싸 하위 트리에 제공하는 Provider.
 * LyricsEditorClient에서 최상단에 한 번만 사용합니다.
 */
export function LyricsEditorProvider({
  song,
  saveSongData,
  children,
}: {
  song: SongEditor;
  saveSongData: SaveSongDataAction;
  children: React.ReactNode;
}) {
  const store = useAdminEditor(song, saveSongData);

  return <LyricsEditorContext.Provider value={store}>{children}</LyricsEditorContext.Provider>;
}

/**
 * LyricsEditorContext를 소비하는 커스텀 훅.
 * LyricsEditorProvider 외부에서 호출하면 에러를 던집니다.
 *
 * @example
 * const { lyrics, handleSave } = useLyricsEditorContext();
 */
export function useLyricsEditorContext(): AdminEditorStore {
  const ctx = useContext(LyricsEditorContext);
  if (!ctx) {
    throw new Error(
      "useLyricsEditorContext는 <LyricsEditorProvider> 내부에서만 사용할 수 있습니다.",
    );
  }
  return ctx;
}
