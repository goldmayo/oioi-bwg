"use client";

import { useState } from "react";

import type { LyricLine } from "@/entities/cheer-guide";

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

import { useAdminEditorContext } from "./AdminEditorContext";

interface RawTextEditorProps {
  line: LyricLine;
  lineIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

export function RawTextEditor({ line, lineIndex, isOpen, onClose }: RawTextEditorProps) {
  const { updateLine } = useAdminEditorContext();
  const [text, setText] = useState("");

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const [prevLine, setPrevLine] = useState(line);

  if (isOpen !== prevIsOpen || line !== prevLine) {
    setPrevIsOpen(isOpen);
    setPrevLine(line);
    if (isOpen) {
      const rawText = (line.segments || []).map((s) => s.text).join("");
      setText(rawText);
    }
  }

  const handleSave = () => {
    const rawText = (line.segments || []).map((s) => s.text).join("");
    if (text !== rawText) {
      updateLine(lineIndex, {
        segments: [{ text, isCheer: false, isEcho: false }],
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>가사 텍스트 수정</DialogTitle>
          <DialogDescription>
            텍스트를 수정하면 해당 줄의 기존 응원법/에코 속성이 초기화됩니다.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="가사를 입력하세요"
            autoFocus
            className="text-lg"
          />
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
