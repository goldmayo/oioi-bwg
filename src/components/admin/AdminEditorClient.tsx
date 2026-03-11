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
    captureTime,
    currentIndex,
    player,
    addExtraLine,
    lastAddedTimeRef,
  } = useAdminEditorContext();

  // QWER 단축키 시스템
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 입력창(Input, Textarea 등)을 포커스 중일 때는 단축키 무시
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const key = e.key.toLowerCase();
      if (!["q", "w", "e", "r"].includes(key)) return;

      e.preventDefault(); // 영상 재생/일시정지, 텍스트 입력 등의 기본 동작 방지

      switch (key) {
        case "q":
          // Q: 현재 행 캡처 (Sync)
          captureTime(currentIndex);
          break;
        case "w":
          // W: 재생 / 일시정지 토글
          if (player) {
            const state = player.getPlayerState();
            // 1: playing
            if (state === 1) {
              player.pauseVideo();
            } else {
              player.playVideo();
            }
          }
          break;
        case "e":
          // E: Extra(추임새) 행 추가
          const addedTime = addExtraLine(currentIndex);
          lastAddedTimeRef.current = addedTime;
          break;
        case "r":
          // R: Recording(녹화) 모드 토글
          setIsRecording(!isRecording);
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isRecording, captureTime, currentIndex, player, addExtraLine, lastAddedTimeRef, setIsRecording]);

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
              <div className="flex justify-between items-center bg-muted/30 px-3 py-2 rounded-t-lg border-b border-border text-xs text-muted-foreground">
                <div className="flex gap-3">
                  <span className="font-bold"><kbd className="bg-background border px-1 rounded text-primary">Q</kbd> 캡처</span>
                  <span className="font-bold"><kbd className="bg-background border px-1 rounded">W</kbd> 재생/일시정지</span>
                  <span className="font-bold"><kbd className="bg-background border px-1 rounded">E</kbd> 추임새 행 추가</span>
                  <span className="font-bold"><kbd className="bg-background border px-1 rounded">R</kbd> 녹화(자동이동) 토글</span>
                </div>
                <Button
                  onClick={() => setIsRecording(!isRecording)}
                  variant={isRecording ? "destructive" : "secondary"}
                  size="sm"
                  className="font-bold h-7 text-xs"
                >
                  {isRecording ? "[R] 녹화 중 (자동이동 ON)" : "[R] 녹화 모드 켜기"}
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
