"use client";

import { Check, ChevronRight, FileInput, Redo2, Undo2, Youtube } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";
import { Textarea } from "@/shared/ui/textarea";

import { useLyricsEditorContext } from "./LyricsEditorContext";

export function EditorTopBar() {
  const editor = useLyricsEditorContext();
  return (
    <header className="shrink-0 px-4 pt-4 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-4">
        <div>
          <p className="text-muted-foreground mb-2 flex items-center gap-1.5 text-xs">
            곡 관리
            <ChevronRight size={12} />
            가사 편집
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">{editor.title}</h1>
            <span
              role="status"
              className={
                editor.isDirty ? "text-xs text-amber-300" : "text-muted-foreground text-xs"
              }
            >
              {editor.isDirty ? "저장하지 않은 변경" : "저장됨"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={editor.undo}
            disabled={!editor.canUndo}
            aria-label="실행 취소"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={editor.redo}
            disabled={!editor.canRedo}
            aria-label="다시 실행"
          >
            <Redo2 size={16} />
          </Button>
          <Dialog open={editor.isImportOpen} onOpenChange={editor.setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileInput size={14} />
                <span className="hidden sm:inline">LRC 가져오기</span>
                <span className="sr-only sm:hidden">LRC 가져오기</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>LRC 가사 가져오기</DialogTitle>
                <DialogDescription>
                  시간 태그가 있는 가사를 붙여 넣습니다. 적용한 변경은 실행 취소할 수 있습니다.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                aria-label="LRC 가사"
                value={editor.lrcInput}
                onChange={(e) => editor.setLrcInput(e.target.value)}
                placeholder="[00:12.34] 가사 내용"
                className="min-h-72 font-mono text-sm"
              />
              <Button onClick={editor.handleImportLrc}>가져오기</Button>
            </DialogContent>
          </Dialog>
          <Button size="sm" onClick={editor.handleSave} disabled={editor.isSaving}>
            <Check size={15} />
            {editor.isSaving ? "저장 중..." : "저장"}
            <kbd className="ml-1 hidden text-xs opacity-70 sm:inline">Ctrl S</kbd>
          </Button>
        </div>
      </div>
      <div className="border-border mb-4 flex flex-wrap items-center justify-between gap-3 border-y py-2.5 text-xs">
        <div className="flex min-w-0 items-center gap-2">
          <Youtube size={16} className="text-muted-foreground" />
          <label htmlFor="editor-youtube-id" className="text-muted-foreground shrink-0">
            참고 영상
          </label>
          <Input
            id="editor-youtube-id"
            value={editor.youtubeId}
            onChange={editor.handleYoutubeIdChange}
            placeholder="YouTube URL 또는 ID"
            className="h-8 w-28 text-xs sm:w-52"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-muted-foreground">
            전체<span className="hidden sm:inline"> 오프셋</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            aria-label="전체 가사 0.1초 앞당기기"
            onClick={() => editor.applyGlobalOffset(-0.1)}
            className="h-7 px-2 text-xs"
          >
            −0.1s
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-label="전체 가사 0.1초 늦추기"
            onClick={() => editor.applyGlobalOffset(0.1)}
            className="h-7 px-2 text-xs"
          >
            +0.1s
          </Button>
        </div>
      </div>
    </header>
  );
}
