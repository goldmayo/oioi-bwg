"use client";

import { useEffect } from "react";

import { YoutubePlayer } from "@/components/common/YoutubePlayer";
import { Button } from "@/components/ui/button";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";

import { AdminEditorProvider, useAdminEditorContext } from "./editor/AdminEditorContext";
import { EditorTopBar } from "./editor/EditorTopBar";
import { FloatingToolbar } from "./editor/FloatingToolbar";
import { LyricsTable } from "./editor/LyricsTable";
import { AdminEditorSong } from "./editor/useAdminEditor";
import { PreviewRail } from "./PreviewRail";

interface AdminEditorClientProps {
  song: AdminEditorSong;
}

/**
 * AdminEditor의 실제 UI 조립도.
 * AdminEditorProvider 내부에서 렌더링되므로 useAdminEditorContext() 사용 가능.
 *
 * 레이아웃 구조:
 * ┌────────────────────────────────────────┐
 * │ EditorTopBar (상단 컨트롤)             │
 * ├──────────────────┬─────────────────────┤
 * │ YoutubePlayer    │ LyricsTable         │
 * │ (좌 패널)        │ (우 패널)           │
 * ├──────────────────┴─────────────────────┤
 * │ PreviewRail (하단 타임라인 미리보기)   │
 * └────────────────────────────────────────┘
 */
function AdminEditorInner() {
  const {
    youtubeId,
    isRecording,
    setIsRecording,
    lyrics,
    subscribeToTime,
    handleTimeUpdate,
    setPlayer,
    addExtraLine,
    lastAddedTimeRef,
  } = useAdminEditorContext();

  // X 키: 현재 위치에 추임새(isExtra) 행 추가
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        const addedTime = addExtraLine();
        lastAddedTimeRef.current = addedTime;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [addExtraLine, lastAddedTimeRef]);

  return (
    <div className="bg-background flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* 드래그 선택 말풍선 툴바 (전역 fixed 포지션) */}
      <FloatingToolbar />

      {/* 상단 컨트롤 바 */}
      <EditorTopBar />

      {/* 메인 패널: YoutubePlayer + LyricsTable */}
      <div className="flex h-[50vh] min-h-100 shrink-0">
        <ResizablePanelGroup orientation="horizontal" className="flex gap-4">
          {/* 좌 패널: YoutubePlayer + 녹화 모드 버튼 */}
          <ResizablePanel defaultSize={50} minSize={20}>
            <div className="flex h-full flex-col gap-2">
              <div className="flex justify-end">
                <Button
                  onClick={() => setIsRecording(!isRecording)}
                  variant={isRecording ? "destructive" : "secondary"}
                  className="font-bold"
                >
                  {isRecording ? "[REC] 녹화 중 (Space로 캡처)" : "녹화 모드 켜기"}
                </Button>
              </div>
              <div className="border-border min-h-0 flex-1 overflow-hidden rounded-lg border bg-black shadow-inner">
                <YoutubePlayer
                  key={youtubeId}
                  videoId={youtubeId}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayerReady={setPlayer}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="w-2 border-none bg-transparent" />

          {/* 우 패널: 가사 편집 테이블 */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <LyricsTable />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* 하단: 실시간 타임라인 미리보기 */}
      <div className="border-border bg-card flex min-h-50 flex-1 flex-col rounded-lg border p-4 shadow-sm">
        <h2 className="text-muted-foreground mb-2 text-[10px] font-semibold tracking-widest uppercase">
          실시간 프리뷰 레일
        </h2>
        <div className="relative min-h-0 flex-1">
          <PreviewRail lyrics={lyrics} subscribeToTime={subscribeToTime} />
        </div>
      </div>
    </div>
  );
}

/**
 * 어드민 에디터 최상위 컴포넌트.
 *
 * AdminEditorProvider로 감싸 하위 컴포넌트들이 Context를 통해
 * 모든 상태와 핸들러에 prop drilling 없이 접근할 수 있게 합니다.
 */
export function AdminEditorClient({ song }: AdminEditorClientProps) {
  return (
    <AdminEditorProvider song={song}>
      <AdminEditorInner />
    </AdminEditorProvider>
  );
}
