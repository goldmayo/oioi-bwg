"use client";

import { useForm } from "react-hook-form";
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

export function RawTextEditor({ isOpen, onClose, ...props }: RawTextEditorProps) {
  return (
    <Dialog open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>가사 텍스트 수정</DialogTitle>
          <DialogDescription>
            조각별 내용을 수정합니다. 응원·에코 속성과 시작 시각은 유지합니다.
          </DialogDescription>
        </DialogHeader>
        {isOpen && <TextFields {...props} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  );
}

function TextFields({ line, lineIndex, onClose }: Omit<RawTextEditorProps, "isOpen">) {
  const { updateLine } = useLyricsEditorContext();
  const { register, handleSubmit } = useForm({
    defaultValues: { texts: line.segments.map((segment) => segment.text) },
  });
  return (
    <form
      onSubmit={handleSubmit(({ texts }) => {
        if (line.segments.some((segment, index) => segment.text !== texts[index])) {
          updateLine(lineIndex, {
            segments: line.segments.map((segment, index) => ({ ...segment, text: texts[index] })),
          });
        }
        onClose();
      })}
    >
      <div className="max-h-[60vh] space-y-4 overflow-auto py-4">
        {line.segments.map((segment, index) => (
          <label key={index} className="flex flex-col gap-2 text-sm">
            {line.segments.length === 1 ? "내용" : `${index + 1}번째 조각 내용`}
            <Input
              aria-label={`${index + 1}번째 조각 내용`}
              {...register(`texts.${index}`)}
              autoFocus={index === 0}
              className="text-lg"
            />
          </label>
        ))}
      </div>
      <DialogFooter>
        <Button title="텍스트 수정 취소" type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button title="텍스트 수정 적용" type="submit">
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}
