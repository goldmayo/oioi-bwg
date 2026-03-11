"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatTime } from "@/utils/lrc-parser";
import { cn } from "@/utils/utils";

import { useAdminEditorContext } from "./AdminEditorContext";

/**
 * 현재 재생 시간을 구독하여 표시하는 독립 컴포넌트.
 * 리렌더링을 이 컴포넌트 내부로 격리하여 상위 트리의 불필요한 렌더링을 방지합니다.
 */
function TimeDisplay() {
  const { subscribeToTime } = useAdminEditorContext();
  const [time, setTime] = useState(0);

  useEffect(() => {
    return subscribeToTime((newTime) => setTime(newTime));
  }, [subscribeToTime]);

  return (
    <div className="bg-muted text-muted-foreground border-border rounded border px-3 py-1 font-mono text-sm">
      {formatTime(time)}
    </div>
  );
}

/**
 * 어드민 에디터 상단 컨트롤 바.
 *
 * 좌측: 곡 제목 / YouTube URL 입력 / 전체 오프셋(-0.1s, +0.1s) / Undo·Redo
 * 우측: LRC Import Dialog / 저장 버튼
 *
 * YoutubePlayer 패널의 TimeDisplay도 이 컴포넌트 외부에서 관리하지만,
 * TimeDisplay는 subscribeToTime이 필요하므로 Context에서 직접 접근합니다.
 */
export function EditorTopBar() {
  const {
    youtubeId,
    isSaving,
    canUndo,
    canRedo,
    isImportOpen,
    lrcInput,
    currentIndex,
    lyrics,
    handleYoutubeIdChange,
    applyGlobalOffset,
    applyRowOffset,
    undo,
    redo,
    handleSave,
    setIsImportOpen,
    setLrcInput,
    handleImportLrc,
  } = useAdminEditorContext();

  const selectedLine = currentIndex >= 0 ? lyrics[currentIndex] : null;

  return (
    <div className="border-border bg-card flex shrink-0 items-center justify-between rounded-lg border p-3 shadow-sm">
      {/* 좌측 컨트롤 그룹 */}
      <div className="flex items-center gap-4">
        {/* 시간 표시 */}
        <TimeDisplay />

        {/* YouTube ID 입력 */}
        <div className="border-border flex items-center gap-2 border-l pl-4">
          <span className="text-muted-foreground text-xs font-bold">YouTube</span>
          <Input
            placeholder="URL 또는 ID 붙여넣기"
            value={youtubeId}
            onChange={handleYoutubeIdChange}
            className="border-input bg-background text-foreground h-8 w-56 text-xs"
          />
        </div>

        {/* 전체 오프셋 조절 */}
        <div className="border-border flex flex-col gap-1 border-l pl-4">
          <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
            전체 오프셋
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="sm" onClick={() => applyGlobalOffset(-0.1)}>
              -0.1s
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyGlobalOffset(0.1)}>
              +0.1s
            </Button>
          </div>
        </div>

        {/* 선택 행 오프셋 조절 */}
        <div className="border-border flex flex-col gap-1 border-l pl-4">
          <span
            className={cn(
              "text-[10px] font-semibold tracking-wider uppercase",
              selectedLine ? "text-primary" : "text-muted-foreground/40",
            )}
          >
            선택 행
            {selectedLine && (
              <span className="ml-1 font-mono font-normal">
                ({formatTime(selectedLine.startTime)})
              </span>
            )}
          </span>
          <div className="flex gap-1">
            <Button
              variant="default"
              size="sm"
              disabled={!selectedLine}
              onClick={() => applyRowOffset(-0.1)}
              className="bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 border"
            >
              -0.1s
            </Button>
            <Button
              variant="default"
              size="sm"
              disabled={!selectedLine}
              onClick={() => applyRowOffset(0.1)}
              className="bg-primary/10 text-primary border-primary/30 hover:bg-primary/20 border"
            >
              +0.1s
            </Button>
          </div>
        </div>

        {/* Undo / Redo */}
        <div className="ml-4 flex gap-2">
          <Button variant="secondary" size="sm" onClick={undo} disabled={!canUndo}>
            Undo
          </Button>
          <Button variant="secondary" size="sm" onClick={redo} disabled={!canRedo}>
            Redo
          </Button>
        </div>
      </div>

      {/* 우측: LRC Import + 저장 */}
      <div className="flex gap-2">
        <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
          <DialogTrigger asChild>
            <Button variant="outline">LRC Import</Button>
          </DialogTrigger>
          <DialogContent className="border-border bg-card text-foreground max-w-2xl">
            <DialogHeader>
              <DialogTitle>LRC 가사 붙여넣기</DialogTitle>
            </DialogHeader>
            <Textarea
              className="border-input bg-background min-h-100 font-mono text-sm"
              placeholder="[00:12.34] 가사 내용..."
              value={lrcInput}
              onChange={(e) => setLrcInput(e.target.value)}
            />
            <Button onClick={handleImportLrc} className="w-full">
              적용하기
            </Button>
          </DialogContent>
        </Dialog>

        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {isSaving ? "저장 중..." : "저장 (Ctrl+S)"}
        </Button>
      </div>
    </div>
  );
}
