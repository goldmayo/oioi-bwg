"use client";

import { Check, LoaderCircle, Redo2, Save, Undo2 } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { EditorPreview } from "./EditorPreview";
import { EditorTransport } from "./EditorTransport";
import { useLyricsEditorContext } from "./LyricsEditorContext";

export function EditorTopBar({ blocked }: { blocked: boolean }) {
  const editor = useLyricsEditorContext();
  return (
    <header className="border-border relative z-30 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b px-4 py-4 lg:min-h-20 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-6 lg:py-3">
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
        <h1
          className="truncate text-xl font-semibold tracking-tight xl:text-2xl"
          title={editor.title}
        >
          {editor.title}
        </h1>
        <span
          role="status"
          title={editor.isDirty ? "저장하지 않은 변경" : "저장됨"}
          className={editor.isDirty ? "size-1.5 shrink-0 rounded-full bg-amber-300" : "sr-only"}
        >
          <span className="sr-only">{editor.isDirty ? "저장하지 않은 변경" : "저장됨"}</span>
        </span>
        {editor.albumName && (
          <span
            className="text-muted-foreground max-w-full truncate text-xs lg:max-w-44 xl:max-w-60"
            title={editor.albumName}
          >
            {editor.albumName}
          </span>
        )}
      </div>
      <div className="col-span-2 row-start-2 flex flex-wrap items-center justify-center gap-3 lg:col-span-1 lg:col-start-2 lg:row-start-1 xl:gap-5">
        <EditorTransport blocked={blocked} />
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="실행 취소"
            aria-label="실행 취소"
            onClick={editor.undo}
            disabled={blocked || !editor.canUndo}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="다시 실행"
            aria-label="다시 실행"
            onClick={editor.redo}
            disabled={blocked || !editor.canRedo}
          >
            <Redo2 />
          </Button>
        </div>
      </div>
      <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 lg:col-start-3">
        <EditorPreview blocked={blocked} />
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-2 px-3 [&_svg]:size-4"
          title="저장"
          onClick={editor.handleSave}
          disabled={blocked || editor.isSaving}
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
                <Check className="bg-background absolute -right-1 -bottom-1 !size-3 rounded-sm" />
              )}
            </span>
          )}
          {editor.isSaving ? "저장 중" : "저장"}
        </Button>
      </div>
    </header>
  );
}
