"use client";

import { Check, LoaderCircle, MapPin, Redo2, Repeat2, Save, Undo2 } from "lucide-react";

import { Button } from "@/shared/ui/button";

import { EditorTools } from "./EditorTools";
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
    <header className="border-border relative z-30 grid shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 border-b px-4 py-4 lg:min-h-20 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-6 lg:py-3">
      <div className="flex min-w-0 items-center gap-3">
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
      </div>
      <div className="col-span-2 row-start-2 flex flex-wrap items-center justify-center gap-3 lg:col-span-1 lg:col-start-2 lg:row-start-1 xl:gap-5">
        <EditorTransport blocked={props.blocked} />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            title="구간 반복"
            aria-label="구간 반복"
            aria-pressed={props.looping}
            disabled={props.blocked || !editor.player}
            onClick={props.onLoop}
            className={`size-11 rounded-md border-white/10 bg-white/[0.03] [&_svg]:size-5 ${props.looping ? "border-cyan-400 text-cyan-300" : ""}`}
          >
            <Repeat2 className="size-5" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="현재 위치에 노트 추가"
            aria-label="현재 위치에 노트 추가"
            disabled={props.blocked}
            onClick={props.onAdd}
            className="size-11 rounded-md border-white/10 bg-white/[0.03] [&_svg]:size-6"
          >
            <MapPin className="size-6" strokeWidth={1.5} />
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="실행 취소"
            aria-label="실행 취소"
            onClick={editor.undo}
            disabled={props.blocked || !editor.canUndo}
          >
            <Undo2 />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            title="다시 실행"
            aria-label="다시 실행"
            onClick={editor.redo}
            disabled={props.blocked || !editor.canRedo}
          >
            <Redo2 />
          </Button>
        </div>
      </div>
      <div className="col-start-2 row-start-1 flex items-center justify-end gap-2 lg:col-start-3">
        <EditorTools blocked={props.blocked} />
        <Button
          className="h-11 w-24 gap-3 border border-white/70 bg-neutral-50 font-normal text-neutral-900 hover:bg-white xl:w-32 [&_svg]:size-4 [&_svg]:stroke-[1.5]"
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
                <Check className="absolute -right-1 -bottom-1 !size-3 rounded-sm bg-neutral-50" />
              )}
            </span>
          )}
          {editor.isSaving ? "저장 중" : "저장"}
        </Button>
      </div>
    </header>
  );
}
