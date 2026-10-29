"use client";

import { Check, FileInput, LoaderCircle, MapPin, Redo2, Repeat2, Save, Undo2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";

import { EditorTransport } from "./EditorTransport";
import { useLyricsEditorContext } from "./LyricsEditorContext";

export function EditorTopBar(props: {
  blocked: boolean;
  looping: boolean;
  onLoop: () => void;
  onAdd: () => void;
}) {
  const editor = useLyricsEditorContext();
  return (
    <header className="border-border shrink-0 border-b px-4 py-3 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
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
        <div className="flex flex-wrap items-center gap-2">
          <EditorTransport blocked={props.blocked} />
          <Button
            variant="outline"
            size="icon"
            title="구간 반복"
            aria-label="구간 반복"
            aria-pressed={props.looping}
            disabled={props.blocked || !editor.player}
            onClick={props.onLoop}
            className={props.looping ? "border-cyan-400 text-cyan-300" : ""}
          >
            <Repeat2 size={16} />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="현재 위치에 노트 추가"
            aria-label="현재 위치에 노트 추가"
            disabled={props.blocked}
            onClick={props.onAdd}
          >
            <MapPin size={17} />
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={editor.undo}
            disabled={props.blocked || !editor.canUndo}
            aria-label="실행 취소"
          >
            <Undo2 size={16} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={editor.redo}
            disabled={props.blocked || !editor.canRedo}
            aria-label="다시 실행"
          >
            <Redo2 size={16} />
          </Button>
          <Dialog open={editor.isImportOpen} onOpenChange={editor.setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" title="LRC 가져오기" disabled={props.blocked}>
                <FileInput size={14} />

                <span className="sr-only">LRC 가져오기</span>
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
          <Button
            size="sm"
            className="gap-2 font-normal [&_svg]:size-4 [&_svg]:stroke-[1.5]"
            title="저장"
            onClick={editor.handleSave}
            disabled={props.blocked || editor.isSaving}
            data-save-state={
              editor.isSaving ? "saving" : editor.hasSaved && !editor.isDirty ? "saved" : "idle"
            }
          >
            {editor.isSaving ? (
              <LoaderCircle className="animate-spin motion-reduce:animate-none" />
            ) : (
              <span className="relative inline-flex" aria-hidden="true">
                <Save />
                {editor.hasSaved && !editor.isDirty && (
                  <Check className="bg-primary text-primary-foreground absolute -right-1 -bottom-1 !size-3 rounded-sm" />
                )}
              </span>
            )}
            {editor.isSaving ? "저장 중" : "저장"}
          </Button>
        </div>
      </div>
      <details className="text-muted-foreground mt-2 text-xs">
        <summary className="w-fit cursor-pointer">전체 가사 시각 조정</summary>
        <div className="mt-2 flex items-center gap-2">
          <span>전체 가사 시각</span>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            aria-label="전체 가사 0.1초 앞당기기"
            disabled={props.blocked || !editor.lyrics.length}
            onClick={() => editor.applyGlobalOffset(-0.1)}
          >
            −0.1s
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7"
            aria-label="전체 가사 0.1초 늦추기"
            disabled={props.blocked || !editor.lyrics.length}
            onClick={() => editor.applyGlobalOffset(0.1)}
          >
            +0.1s
          </Button>
        </div>
      </details>
    </header>
  );
}
