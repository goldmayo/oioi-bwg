"use client";

import { Pencil, Plus, RefreshCw, Target, Trash2, X as CloseIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { saveSongData } from "@/app/admin/actions";
import { PreviewRail } from "@/components/admin/PreviewRail";
import { YoutubePlayer } from "@/components/common/YoutubePlayer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { useAdWatcher } from "@/hooks/useAdWatcher";
import { useLyricsEditor } from "@/hooks/useLyricsEditor";
import { LyricLine, LyricSegment } from "@/types/lyrics";
import { YouTubePlayerInstance } from "@/types/youtube";
import { formatTime, parseLrc, parseTime } from "@/utils/lrc-parser";
import { cn } from "@/utils/utils";

interface AdminEditorClientProps {
  song: {
    id: number;
    title: string;
    youtubeId: string;
    lyrics: unknown;
  };
}

function TimeDisplay({
  subscribeToTime,
}: {
  subscribeToTime: (listener: (time: number) => void) => () => void;
}) {
  const [time, setTime] = useState(0);

  useEffect(() => {
    return subscribeToTime((newTime) => setTime(newTime));
  }, [subscribeToTime]);

  return (
    <div className="bg-muted text-muted-foreground border-border rounded border px-3 py-1 font-mono text-sm">
      {formatTime(time)}
    </div>
  );
}

export function AdminEditorClient({ song }: AdminEditorClientProps) {
  const initialLyrics = (song.lyrics as LyricLine[]) || [];

  const {
    lyrics,
    currentIndex,
    setCurrentIndex,
    isRecording,
    setIsRecording,
    currentTimeRef,
    onTimeUpdate,
    subscribeToTime,
    updateLine,
    captureTime,
    addExtraLine,
    addSegmentToExtra,
    removeSegmentFromExtra,
    deleteLine,
    importLyrics,
    applyGlobalOffset,
    undo,
    redo,
    canUndo,
    canRedo,
  } = useLyricsEditor(initialLyrics);

  const [isSaving, setIsSaving] = useState(false);
  const [lrcInput, setLrcInput] = useState("");
  const [isImportOpen, setIsImportOpen] = useState(false);

  const [youtubeId, setYoutubeId] = useState(song.youtubeId);

  // 광고 감지를 위한 플레이어 객체 상태 (타입 명시)
  const [player, setPlayer] = useState<YouTubePlayerInstance | null>(null);

  // 광고 감시 훅
  const isAdPlaying = useAdWatcher(player, youtubeId);

  const [toolbar, setToolbar] = useState<{
    show: boolean;
    x: number;
    y: number;
    lineIndex: number;
    segmentIndex: number;
    startOffset: number;
    endOffset: number;
  } | null>(null);

  const lastAddedTimeRef = useRef<number | null>(null);

  /**
   * 광고 중에는 시간을 업데이트하지 않아 싱크가 어긋나는 것을 방지합니다.
   */
  const handleTimeUpdate = (time: number) => {
    if (!isAdPlaying) {
      onTimeUpdate(time);
    }
  };

  /**
   * 현재 재생 시간을 기준으로 특정 세그먼트의 startTimeOffset을 캡처합니다.
   * offset = 현재 재생 시간 - 라인의 startTime
   */
  const captureSegmentOffset = (lineIndex: number, segmentIndex: number) => {
    const line = lyrics[lineIndex];
    if (!line) return;
    const offset = parseFloat((currentTimeRef.current - line.startTime).toFixed(2));
    const newSegments = [...line.segments];
    newSegments[segmentIndex] = { ...newSegments[segmentIndex], startTimeOffset: Math.max(0, offset) };
    updateLine(lineIndex, { segments: newSegments });
  };

  /**
   * 특정 세그먼트의 속성을 부분 업데이트하는 헬퍼.
   */
  const updateSegment = (lineIndex: number, segmentIndex: number, partial: Partial<LyricSegment>) => {
    const line = lyrics[lineIndex];
    if (!line) return;
    const newSegments = [...line.segments];
    newSegments[segmentIndex] = { ...newSegments[segmentIndex], ...partial };
    updateLine(lineIndex, { segments: newSegments });
  };

  const handleYoutubeIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const match = val.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
    );
    if (match && match[1]) {
      setYoutubeId(match[1]);
    } else {
      setYoutubeId(val);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    const result = await saveSongData(song.id, { lyrics, youtubeId });
    setIsSaving(false);
    if (result.success) {
      alert("저장되었습니다.");
    } else {
      alert(`저장 실패: ${result.error}`);
    }
  };

  const handleImportLrc = () => {
    try {
      const parsed = parseLrc(lrcInput);
      if (parsed.length > 0) {
        importLyrics(parsed);
        setIsImportOpen(false);
        setLrcInput("");
      } else {
        alert("파싱된 가사가 없습니다. 형식을 확인해주세요.");
      }
    } catch (_e) {
      alert("LRC 파싱 중 오류가 발생했습니다.");
    }
  };

  const handleMouseUpText = (e: React.MouseEvent, lineIndex: number) => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) {
      setToolbar(null);
      return;
    }

    let node = selection.anchorNode;
    if (!node) return;
    if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;

    const element = node as HTMLElement;
    const lineIdxStr = element.getAttribute("data-line");
    const segIdxStr = element.getAttribute("data-seg");

    if (lineIdxStr && segIdxStr && parseInt(lineIdxStr) === lineIndex) {
      const rect = selection.getRangeAt(0).getBoundingClientRect();
      const start = Math.min(selection.anchorOffset, selection.focusOffset);
      const end = Math.max(selection.anchorOffset, selection.focusOffset);

      if (start !== end) {
        setToolbar({
          show: true,
          x: rect.left + rect.width / 2,
          y: rect.top - 40,
          lineIndex,
          segmentIndex: parseInt(segIdxStr),
          startOffset: start,
          endOffset: end,
        });
      }
    }
  };

  const handleSplitSegment = (type: "echo" | "reset") => {
    if (!toolbar) return;
    const { lineIndex, segmentIndex, startOffset, endOffset } = toolbar;

    const line = lyrics[lineIndex];
    if (!line) return;
    const seg = line.segments[segmentIndex];
    if (!seg) return;

    const beforeText = seg.text.slice(0, startOffset);
    const selectedText = seg.text.slice(startOffset, endOffset);
    const afterText = seg.text.slice(endOffset);

    const newSegments = [...line.segments];
    const replacements = [];

    if (beforeText) replacements.push({ ...seg, text: beforeText });
    if (selectedText) {
      replacements.push({
        ...seg,
        text: selectedText,
        isCheer: type === "echo",
        isEcho: type === "echo",
      });
    }
    if (afterText) replacements.push({ ...seg, text: afterText });

    newSegments.splice(segmentIndex, 1, ...replacements);
    updateLine(lineIndex, { segments: newSegments });
    setToolbar(null);
    window.getSelection()?.removeAllRanges();
  };

  const handleEditRawText = (index: number) => {
    const rawText = lyrics[index].segments.map((s) => s.text).join("");
    const newText = prompt(
      "가사 텍스트를 수정하세요 (기존 세그먼트 속성이 초기화됩니다):",
      rawText,
    );
    if (newText !== null && newText !== rawText) {
      updateLine(index, { segments: [{ text: newText, isCheer: false, isEcho: false }] });
    }
  };

  useEffect(() => {
    if (lastAddedTimeRef.current !== null) {
      const timeStr = lastAddedTimeRef.current.toString();
      const input = document.getElementById(`extra-input-${timeStr}`);
      if (input) {
        input.focus();
        (input as HTMLInputElement).select();
        lastAddedTimeRef.current = null;
      }
    }
  }, [lyrics]);

  useEffect(() => {
    const handleKeyDownExtra = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key.toLowerCase() === "x") {
        e.preventDefault();
        const addedTime = addExtraLine();
        lastAddedTimeRef.current = addedTime;
      }
    };
    window.addEventListener("keydown", handleKeyDownExtra);
    return () => window.removeEventListener("keydown", handleKeyDownExtra);
  }, [addExtraLine]);

  return (
    <div className="bg-background flex h-full flex-col gap-4 overflow-hidden p-4">
      {/* Floating Toolbar */}
      {toolbar?.show && (
        <div
          className="border-border bg-popover fixed z-50 flex gap-1 rounded border p-1 shadow-xl"
          style={{ left: toolbar.x, top: toolbar.y, transform: "translate(-50%, 0)" }}
        >
          <Button
            size="sm"
            variant="ghost"
            className="text-qwer-w hover:bg-qwer-w/10 hover:text-qwer-w h-7 text-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSplitSegment("echo");
            }}
          >
            Echo (따라하기)
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="text-muted-foreground hover:text-foreground h-7 text-xs"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSplitSegment("reset");
            }}
          >
            Reset
          </Button>
        </div>
      )}

      {/* Top Controls */}
      <div className="border-border bg-card flex shrink-0 items-center justify-between rounded-lg border p-3 shadow-sm">
        <div className="flex items-center gap-4">
          <h1 className="text-foreground min-w-30 text-xl font-bold">{song.title}</h1>

          <div className="border-border flex items-center gap-2 border-l pl-4">
            <span className="text-muted-foreground text-xs font-bold">YouTube</span>
            <Input
              placeholder="URL 또는 ID 붙여넣기"
              value={youtubeId}
              onChange={handleYoutubeIdChange}
              className="border-input bg-background text-foreground h-8 w-56 text-xs"
            />
          </div>

          <div className="border-border flex gap-2 border-l pl-4">
            <Button variant="outline" size="sm" onClick={() => applyGlobalOffset(-0.1)}>
              -0.1s
            </Button>
            <Button variant="outline" size="sm" onClick={() => applyGlobalOffset(0.1)}>
              +0.1s
            </Button>
          </div>
          <div className="ml-4 flex gap-2">
            <Button variant="secondary" size="sm" onClick={undo} disabled={!canUndo}>
              Undo
            </Button>
            <Button variant="secondary" size="sm" onClick={redo} disabled={!canRedo}>
              Redo
            </Button>
          </div>
        </div>
        <div className="flex gap-2">
          <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">LRC Import</Button>
            </DialogTrigger>
            <DialogContent className="border-border bg-card text-foreground max-w-2xl">
              <DialogHeader>
                <DialogTitle>LRC 가사 붙여넣기</DialogTitle>
              </DialogHeader>
              <Textarea
                className="border-input bg-background min-h-100 font-mono text-sm"
                placeholder="[00:12.34] 가사 내용..."
                value={lrcInput}
                onChange={(e) => setLrcInput(e.target.value)}
              />
              <Button onClick={handleImportLrc} className="w-full">
                적용하기
              </Button>
            </DialogContent>
          </Dialog>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {isSaving ? "저장 중..." : "저장 (Ctrl+S)"}
          </Button>
        </div>
      </div>

      <div className="flex h-[50vh] min-h-100 shrink-0">
        <ResizablePanelGroup orientation="horizontal" className="flex gap-4">
          {/* Top-Left: Youtube Player */}
          <ResizablePanel defaultSize={50} minSize={20}>
            <div className="flex h-full flex-col gap-2">
              <div className="flex items-center justify-between">
                <TimeDisplay subscribeToTime={subscribeToTime} />
                <div className="flex gap-2">
                  <Button
                    onClick={() => setIsRecording(!isRecording)}
                    variant={isRecording ? "destructive" : "secondary"}
                    className="font-bold"
                  >
                    {isRecording ? "[REC] 녹화 중 (Space로 캡처)" : "녹화 모드 켜기"}
                  </Button>
                </div>
              </div>
              <div className="border-border min-h-0 flex-1 overflow-hidden rounded-lg border bg-black shadow-inner">
                <YoutubePlayer
                  key={youtubeId}
                  videoId={youtubeId}
                  onTimeUpdate={handleTimeUpdate}
                  onPlayerReady={setPlayer}
                />
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle className="w-2 border-none bg-transparent" />

          {/* Top-Right: Table Area */}
          <ResizablePanel defaultSize={50} minSize={30}>
            <div className="border-border bg-card flex h-full flex-col overflow-hidden rounded-lg border shadow-sm">
              <div className="border-border bg-muted/50 text-muted-foreground grid shrink-0 grid-cols-[100px_1fr_60px_220px] gap-2 border-b p-3 text-xs font-bold tracking-wider uppercase">
                <div className="text-center">Time</div>
                <div className="text-center">Lyrics (드래그하여 분리)</div>
                <div className="text-center">Extra</div>
                <div className="text-center">Action</div>
              </div>
              <ScrollArea className="h-full flex-1">
                <div className="flex flex-col gap-1 p-2 pb-10" onMouseDown={() => setToolbar(null)}>
                  {lyrics.map((line, index) => {
                    const isCurrent = index === currentIndex;
                    const isError = index > 0 && line.startTime < lyrics[index - 1].startTime;

                    return (
                      <div
                        key={index}
                        className={`grid grid-cols-[100px_1fr_60px_220px] items-center gap-2 rounded-md border p-2 transition-all ${isCurrent ? "border-primary/50 bg-accent/50 ring-primary/20 ring-1" : "border-border/50 bg-background"} ${isError ? "border-destructive/50 bg-destructive/5" : ""} `}
                        onClick={() => setCurrentIndex(index)}
                      >
                        <Input
                          type="text"
                          value={formatTime(line.startTime)}
                          onChange={(e) =>
                            updateLine(index, { startTime: parseTime(e.target.value) })
                          }
                          className="border-input bg-muted/30 focus-visible:ring-primary/30 h-8 font-mono text-xs"
                        />

                        {/* Lyrics Segments */}
                        {line.isExtra ? (
                          <div className="flex flex-col gap-1.5">
                            {line.segments.map((seg, sIdx) => (
                              <div
                                key={sIdx}
                                className="border-qwer-e/30 bg-qwer-e/5 flex items-center gap-1 rounded border p-1"
                              >
                                {/* 세그먼트 텍스트 */}
                                <Input
                                  value={seg.text}
                                  onChange={(e) => updateSegment(index, sIdx, { text: e.target.value })}
                                  placeholder="텍스트"
                                  className="border-qwer-e/20 text-qwer-e placeholder:text-qwer-e/30 h-7 w-24 text-xs font-bold"
                                />
                                {/* startTimeOffset 입력 */}
                                <span className="text-qwer-e/40 text-[10px]">+</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  value={seg.startTimeOffset ?? 0}
                                  onChange={(e) =>
                                    updateSegment(index, sIdx, {
                                      startTimeOffset: parseFloat(e.target.value),
                                    })
                                  }
                                  className="border-qwer-e/20 text-qwer-e h-7 w-16 text-[10px] font-mono"
                                />
                                <span className="text-qwer-e/40 text-[10px]">s</span>
                                {/* 현재 시간으로 offset 캡처 */}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-qwer-e/70 hover:text-qwer-e hover:bg-qwer-e/10 h-6 w-6"
                                  title="현재 재생 시간으로 오프셋 캡처"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    captureSegmentOffset(index, sIdx);
                                  }}
                                >
                                  <Target size={11} />
                                </Button>
                                {/* 세그먼트 삭제 */}
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="text-destructive/60 hover:text-destructive hover:bg-destructive/10 h-6 w-6"
                                  title="이 세그먼트 삭제"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeSegmentFromExtra(index, sIdx);
                                  }}
                                >
                                  <CloseIcon size={11} />
                                </Button>
                              </div>
                            ))}
                            {/* 세그먼트 추가 버튼 */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className={cn(
                                "text-qwer-e border-qwer-e/30 hover:bg-qwer-e/10 h-7 border border-dashed text-xs",
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                addSegmentToExtra(index);
                              }}
                            >
                              <Plus size={12} className="mr-1" />
                              조각 추가
                            </Button>
                          </div>
                        ) : (
                          <div
                            className={`border-input bg-muted/20 flex h-8 items-center overflow-x-auto rounded border px-2 text-sm`}
                            onMouseUp={(e) => handleMouseUpText(e, index)}
                          >
                            {line.segments?.map((seg, sIdx) => (
                              <span
                                key={sIdx}
                                data-line={index}
                                data-seg={sIdx}
                                className={`selection:bg-primary/20 cursor-text whitespace-pre ${seg.isCheer ? "text-qwer-r font-bold" : ""} ${seg.isEcho ? "text-qwer-r decoration-qwer-r/50 underline underline-offset-4" : ""}`}
                              >
                                {seg.text}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex justify-center">
                          <Checkbox
                            checked={line.isExtra}
                            onCheckedChange={(c) => updateLine(index, { isExtra: !!c })}
                            className="data-[state=checked]:bg-qwer-e data-[state=checked]:border-qwer-e"
                          />
                        </div>
                        <div className="flex justify-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-muted-foreground hover:text-foreground hover:bg-accent h-8 w-8"
                            title="텍스트 수정"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditRawText(index);
                            }}
                          >
                            <Pencil size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="hover:bg-primary/10 hover:text-primary h-8 w-8"
                            title="타임스탬프 동기화 (SYNC)"
                            onClick={(e) => {
                              e.stopPropagation();
                              captureTime(index);
                            }}
                          >
                            <RefreshCw size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-qwer-e/70 hover:text-qwer-e hover:bg-qwer-e/10 h-8 w-8"
                            title="아래에 추임새 행 추가"
                            onClick={(e) => {
                              e.stopPropagation();
                              const addedTime = addExtraLine(index);
                              lastAddedTimeRef.current = addedTime;
                            }}
                          >
                            <Plus size={14} />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive/70 hover:text-destructive hover:bg-destructive/10 h-8 w-8"
                            title="현재 행 삭제"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteLine(index);
                            }}
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Bottom Area: Preview Rail */}
      <div className="border-border bg-card flex min-h-50 flex-1 flex-col rounded-lg border p-4 shadow-sm">
        <h2 className="text-muted-foreground mb-2 text-sm text-[10px] font-semibold tracking-widest uppercase">
          실시간 프리뷰 레일
        </h2>
        <div className="relative min-h-0 flex-1">
          <PreviewRail lyrics={lyrics} subscribeToTime={subscribeToTime} />
        </div>
      </div>
    </div>
  );
}
