"use client";

import { FileInput, MoreHorizontal, ScanLine } from "lucide-react";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Textarea } from "@/shared/ui/textarea";

import { useLyricsEditorContext } from "./LyricsEditorContext";
import { LyricsTimelinePreview } from "./LyricsTimelinePreview";

export function EditorTools({ blocked }: { blocked: boolean }) {
  const editor = useLyricsEditorContext();
  return (
    <>
      <details
        className="relative"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            event.currentTarget.open = false;
            event.currentTarget.querySelector("summary")?.focus();
          }
        }}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget as Node))
            event.currentTarget.open = false;
        }}
      >
        <summary
          role="button"
          aria-label="편집 도구"
          title="편집 도구"
          className="text-muted-foreground hover:bg-accent flex size-9 cursor-pointer list-none items-center justify-center rounded-md focus-visible:outline-2 focus-visible:outline-cyan-300 [&::-webkit-details-marker]:hidden"
        >
          <MoreHorizontal size={18} />
        </summary>
        <div className="bg-popover border-border absolute top-11 right-0 z-40 flex w-72 max-w-[85vw] flex-col gap-3 rounded-md border p-4 shadow-lg">
          <Button
            variant="outline"
            size="sm"
            disabled={blocked}
            onClick={() => editor.setIsImportOpen(true)}
          >
            <FileInput size={14} />
            LRC 가져오기
          </Button>
          <div className="border-border border-t pt-3">
            <p className="text-muted-foreground mb-2 text-xs">전체 가사 시각 조정</p>
            <div className="flex gap-2">
              {[-0.1, 0.1].map((offset) => (
                <Button
                  key={offset}
                  variant="outline"
                  size="sm"
                  aria-label={`전체 가사 0.1초 ${offset < 0 ? "앞당기기" : "늦추기"}`}
                  disabled={blocked || !editor.lyrics.length}
                  onClick={() => editor.applyGlobalOffset(offset)}
                >
                  {offset < 0 ? "−0.1s" : "+0.1s"}
                </Button>
              ))}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={blocked || !editor.player || !editor.lyrics.length}
            onClick={() => editor.captureTime(editor.currentIndex)}
          >
            <ScanLine size={14} />행 시간 캡처
          </Button>
          <Button
            variant="outline"
            size="sm"
            aria-pressed={editor.isRecording}
            disabled={blocked}
            onClick={() => editor.setIsRecording(!editor.isRecording)}
          >
            연속 캡처 {editor.isRecording ? "켜짐" : "꺼짐"}
          </Button>
          <details className="border-border border-t pt-3 text-xs">
            <summary className="cursor-pointer">실시간 응원 미리보기</summary>
            <div className="mt-3 h-20">
              <LyricsTimelinePreview
                lyrics={editor.lyrics}
                subscribeToTime={editor.subscribeToTime}
              />
            </div>
          </details>
        </div>
      </details>
      <Dialog open={editor.isImportOpen} onOpenChange={editor.setIsImportOpen}>
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
    </>
  );
}
