"use client";

import { createContext, useContext } from "react";

import { AdminEditorSong, AdminEditorStore, useAdminEditor } from "./useAdminEditor";

/**
 * AdminEditor 전역 Context.
 * 하위 컴포넌트들은 useAdminEditorContext()로 필요한 값만 꺼내 씁니다.
 * prop drilling 없이 useAdminEditor의 모든 값에 접근할 수 있습니다.
 */
const AdminEditorContext = createContext<AdminEditorStore | null>(null);

/**
 * AdminEditor의 로직(useAdminEditor)을 Context로 감싸 하위 트리에 제공하는 Provider.
 * AdminEditorClient에서 최상단에 한 번만 사용합니다.
 */
export function AdminEditorProvider({
  song,
  children,
}: {
  song: AdminEditorSong;
  children: React.ReactNode;
}) {
  const store = useAdminEditor(song);

  return <AdminEditorContext.Provider value={store}>{children}</AdminEditorContext.Provider>;
}

/**
 * AdminEditorContext를 소비하는 커스텀 훅.
 * AdminEditorProvider 외부에서 호출하면 에러를 던집니다.
 *
 * @example
 * const { lyrics, handleSave } = useAdminEditorContext();
 */
export function useAdminEditorContext(): AdminEditorStore {
  const ctx = useContext(AdminEditorContext);
  if (!ctx) {
    throw new Error("useAdminEditorContext는 <AdminEditorProvider> 내부에서만 사용할 수 있습니다.");
  }
  return ctx;
}
