"use client";

import { useRef, useState } from "react";

import type { LyricLine, LyricSegment } from "@/entities/cheer-guide";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/shared/ui/dialog";

import { useAdminEditorContext } from "./AdminEditorContext";

type PaintMode = "normal" | "cheer" | "echo";

interface CharItem {
  id: string;
  char: string;
  mode: PaintMode;
  startTimeOffset?: number;
}

interface MobilePaintEditorProps {
  line: LyricLine;
  lineIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function MobilePaintEditor({ line, lineIndex, isOpen, onClose }: MobilePaintEditorProps) {
  const { updateLine } = useAdminEditorContext();
  const [chars, setChars] = useState<CharItem[]>([]);
  const [currentMode, setCurrentMode] = useState<PaintMode>("normal");

  // prop 변경 시 상태를 렌더링 중에 동기화 (You Might Not Need an Effect 패턴)
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevLine, setPrevLine] = useState(line);

  if (isOpen !== prevIsOpen || line !== prevLine) {
    setPrevIsOpen(isOpen);
    setPrevLine(line);

    if (isOpen) {
      const newChars: CharItem[] = [];
      let charId = 0;

      for (const seg of line.segments || []) {
        const mode: PaintMode = seg.isEcho ? "echo" : seg.isCheer ? "cheer" : "normal";
        for (let i = 0; i < seg.text.length; i++) {
          newChars.push({
            id: `char-${charId++}`,
            char: seg.text[i],
            mode,
            // 첫 번째 글자에만 기존의 startTimeOffset을 유지
            startTimeOffset: i === 0 ? seg.startTimeOffset : undefined,
          });
        }
      }
      setChars(newChars);
      setCurrentMode("normal"); // 초기 모드
    }
  }

  const isPainting = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleSave = () => {
    const newSegments: LyricSegment[] = [];
    let currentSeg: LyricSegment | null = null;
    let lastMode: PaintMode | null = null;

    for (const item of chars) {
      // 모드가 바뀌거나, 기존 세그먼트의 시작점(startTimeOffset)이 있는 글자라면 강제로 세그먼트를 분리
      if (!currentSeg || lastMode !== item.mode || item.startTimeOffset !== undefined) {
        if (currentSeg) newSegments.push(currentSeg);
        currentSeg = {
          text: item.char,
          isCheer: item.mode === "cheer",
          isEcho: item.mode === "echo",
        };
        if (item.startTimeOffset !== undefined) {
          currentSeg.startTimeOffset = item.startTimeOffset;
        }
        lastMode = item.mode;
      } else {
        currentSeg.text += item.char;
      }
    }
    if (currentSeg) newSegments.push(currentSeg);

    updateLine(lineIndex, { segments: newSegments });
    onClose();
  };

  const paintChar = (index: number) => {
    setChars((prev) => {
      const next = [...prev];
      if (next[index].mode !== currentMode) {
        next[index] = { ...next[index], mode: currentMode };
      }
      return next;
    });
  };

  // 터치/마우스 이벤트 처리 (스와이프/드래그 페인팅 지원)
  const handlePointerDown = (index: number) => {
    isPainting.current = true;
    paintChar(index);
  };

  const handlePointerUp = () => {
    isPainting.current = false;
  };

  // 터치 이동 시 좌표에 해당하는 요소를 찾아서 페인트
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPainting.current) return;
    const touch = e.touches[0];
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el && el.hasAttribute("data-char-idx")) {
      const idx = parseInt(el.getAttribute("data-char-idx")!, 10);
      if (!isNaN(idx)) {
        paintChar(idx);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent
        className="flex max-h-[80vh] flex-col overflow-hidden sm:max-w-md"
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <DialogHeader>
          <DialogTitle>가사 편집 (페인트 모드)</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 flex-col gap-6 overflow-y-auto py-4">
          {/* 모드 선택 팔레트 */}
          <div className="flex justify-center gap-2">
            <Button
              variant={currentMode === "normal" ? "default" : "outline"}
              onClick={() => setCurrentMode("normal")}
              className="flex-1"
            >
              기본
            </Button>
            <Button
              variant={currentMode === "cheer" ? "default" : "outline"}
              onClick={() => setCurrentMode("cheer")}
              className={cn(
                "flex-1",
                currentMode === "cheer" && "bg-qwer-e text-qwer-e-foreground hover:bg-qwer-e/90",
              )}
            >
              응원법
            </Button>
            <Button
              variant={currentMode === "echo" ? "default" : "outline"}
              onClick={() => setCurrentMode("echo")}
              className={cn(
                "flex-1",
                currentMode === "echo" && "bg-qwer-r text-qwer-r-foreground hover:bg-qwer-r/90",
              )}
            >
              에코
            </Button>
          </div>

          {/* 가사 칠하기 영역 */}
          <div
            ref={containerRef}
            className="border-input flex min-h-[150px] touch-none flex-wrap content-start items-start justify-center gap-2 rounded-lg border p-4 select-none"
            onTouchMove={handleTouchMove}
          >
            {chars.map((item, idx) => (
              <div
                key={item.id}
                data-char-idx={idx}
                onPointerDown={() => handlePointerDown(idx)}
                onPointerEnter={() => {
                  // 마우스 드래그 지원
                  if (isPainting.current) paintChar(idx);
                }}
                className={cn(
                  "flex h-12 min-w-8 cursor-pointer items-center justify-center rounded-md text-2xl font-bold transition-colors select-none",
                  item.char === " " ? "w-4 bg-transparent" : "bg-muted shadow-sm",
                  item.mode === "cheer" && "bg-qwer-e/20 text-qwer-e ring-qwer-e ring-2",
                  item.mode === "echo" &&
                    "text-qwer-r ring-qwer-r decoration-qwer-r underline decoration-2 underline-offset-8 ring-2",
                )}
              >
                {item.char}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave}>완료</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
