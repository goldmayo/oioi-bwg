"use client";

import { lazy, Suspense } from "react";

import type { AdminEditorSong } from "./editor/useAdminEditor";

// React.lazy를 사용한 클라이언트 사이드 지연 로딩
const AdminEditorClient = lazy(() => import("./AdminEditorClient"));

interface LazyAdminEditorProps {
  song: AdminEditorSong;
}

export function LazyAdminEditor({ song }: LazyAdminEditorProps) {
  return (
    <Suspense
      fallback={
        <div className="bg-background text-muted-foreground flex h-screen items-center justify-center font-bold">
          에디터 로딩 중...
        </div>
      }
    >
      <AdminEditorClient song={song} />
    </Suspense>
  );
}
