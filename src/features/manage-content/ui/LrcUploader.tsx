"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Upload, X } from "lucide-react";

import { cn } from "@/shared/lib/utils";
import { Button } from "@/shared/ui/button";

interface LrcUploaderProps {
  /** 파싱된 LRC 텍스트를 부모에 전달 */
  onLrcParsed: (lrcText: string) => void;
  /** 현재 설정된 LRC 텍스트 */
  value?: string;
  /** 에러 메시지 */
  error?: string;
}

/**
 * LRC 파일 업로더 (드래그앤드롭 + 파일 선택)
 * .lrc 파일을 읽어 텍스트로 변환 후 부모에 전달합니다.
 */
export function LrcUploader({ onLrcParsed, value, error }: LrcUploaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [lineCount, setLineCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(".lrc")) {
        alert("LRC 파일(.lrc)만 업로드 가능합니다.");
        return;
      }

      try {
        const text = await file.text();
        const lines = text.split("\n").filter((line) => line.trim().length > 0);
        setFileName(file.name);
        setLineCount(lines.length);
        onLrcParsed(text);
      } catch {
        alert("파일 읽기에 실패했습니다.");
      }
    },
    [onLrcParsed],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) void processFile(file);
    },
    [processFile],
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void processFile(file);
      // 동일 파일 재선택 허용
      e.target.value = "";
    },
    [processFile],
  );

  const handleClear = useCallback(() => {
    setFileName(null);
    setLineCount(0);
    onLrcParsed("");
  }, [onLrcParsed]);

  return (
    <div className="space-y-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".lrc"
        onChange={handleFileChange}
        className="hidden"
      />

      {value ? (
        /* ── 업로드 완료 상태 ── */
        <div className="bg-accent/50 border-border flex items-center gap-3 rounded-lg border p-3">
          <FileUp className="text-primary h-5 w-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-foreground truncate text-sm font-medium">{fileName}</p>
            <p className="text-muted-foreground text-xs">{lineCount}줄</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClear}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        /* ── 드래그앤드롭 영역 ── */
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 transition-colors",
            isDragOver
              ? "border-primary bg-primary/5 text-primary"
              : "border-border text-muted-foreground hover:border-primary/50 hover:bg-accent/30",
            error && "border-destructive",
          )}
        >
          <Upload className="h-8 w-8" />
          <div className="text-center">
            <p className="text-sm font-medium">
              LRC 파일을 드래그하거나 <span className="text-primary underline">파일 선택</span>
            </p>
            <p className="text-xs">.lrc 형식만 지원</p>
          </div>
        </div>
      )}

      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
