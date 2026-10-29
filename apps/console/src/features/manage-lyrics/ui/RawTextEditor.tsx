"use client";

import { useState } from "react";
import type { LyricLine } from "@oioi-bwg/contracts/song";

import { Button } from "@/shared/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/shared/ui/dialog";
import { Input } from "@/shared/ui/input";

import { useLyricsEditorContext } from "./LyricsEditorContext";

interface RawTextEditorProps {
  line: LyricLine;
  lineIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function RawTextEditor({ line, lineIndex, isOpen, onClose }: RawTextEditorProps) {
  const { updateLine } = useLyricsEditorContext();
  const [texts, setTexts] = useState<string[]>([]);

  const [prevIsOpen, setPrevIsOpen] = useState(false);
  const [prevLine, setPrevLine] = useState(line);

  if (isOpen !== prevIsOpen || line !== prevLine) {
    setPrevIsOpen(isOpen);
    setPrevLine(line);
    if (isOpen) {
      setTexts(line.segments.map((segment) => segment.text));
    }
  }

  const handleSave = () => {
    if (line.segments.some((segment, index) => segment.text !== texts[index])) {
      updateLine(lineIndex, {
        segments: line.segments.map((segment, index) => ({ ...segment, text: texts[index] })),
      });
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>가사 텍스트 수정</DialogTitle>
          <DialogDescription>
            조각별 내용을 수정합니다. 응원·에코 속성과 시작 시각은 유지합니다.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-auto py-4">
          {texts.map((text, index) => (
            <label key={index} className="flex flex-col gap-2 text-sm">
              {texts.length === 1 ? "내용" : `${index + 1}번째 조각 내용`}
              <Input
                aria-label={`${index + 1}번째 조각 내용`}
                value={text}
                onChange={(event) =>
                  setTexts((values) =>
                    values.map((value, i) => (i === index ? event.target.value : value)),
                  )
                }
                onKeyDown={handleKeyDown}
                autoFocus={index === 0}
                className="text-lg"
              />
            </label>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
