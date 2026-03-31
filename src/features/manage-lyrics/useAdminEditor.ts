"use client";

import { useCallback, useRef, useState } from "react";

import { saveSongData } from "@/features/manage-lyrics/actions";
import { useAdWatcher } from "@/shared/hooks/useAdWatcher";
import { useLyricsEditor } from "@/shared/hooks/useLyricsEditor";
import { LyricLine, LyricSegment } from "@/shared/types/lyrics";
import { YouTubePlayerInstance } from "@/shared/types/youtube";
import { parseLrc } from "@/shared/utils/lrc-parser";

/** 드래그 선택 말풍선 툴바의 상태 */
export interface ToolbarState {
  show: boolean;
  x: number;
  y: number;
  lineIndex: number;
  segmentIndex: number;
  startOffset: number;
  endOffset: number;
}

/** useAdminEditor 훅에 필요한 초기 곡 정보 */
export interface AdminEditorSong {
  id: number;
  title: string;
  youtubeId: string;
  lyrics: unknown;
}

/**
 * AdminEditor의 모든 상태와 핸들러를 담는 단일 로직 게이트웨이.
 *
 * 이 파일 하나로 AdminEditorClient의 전체 동작을 이해할 수 있습니다.
 * - 가사 편집 로직은 useLyricsEditor에 위임
 * - 어드민 전용 상태(YouTube ID, 저장, LRC Import, 툴바)를 추가로 관리
 */
export function useAdminEditor(song: AdminEditorSong) {
  // ─── 가사 편집 (useLyricsEditor에 위임) ───────────────────────────────────
  const lyricsEditor = useLyricsEditor((song.lyrics as LyricLine[]) || []);
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
  } = lyricsEditor;

  // ─── 어드민 전용 상태 ───────────────────────────────────────────────────────
  const [player, setPlayer] = useState<YouTubePlayerInstance | null>(null);
  const [youtubeId, setYoutubeId] = useState(song.youtubeId);
  const [isSaving, setIsSaving] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [lrcInput, setLrcInput] = useState("");
  const [toolbar, setToolbar] = useState<ToolbarState | null>(null);

  /** 마지막으로 추가된 추임새 행의 시간. 포커스 이동에 사용. */
  const lastAddedTimeRef = useRef<number | null>(null);

  /** 광고 감시 훅 (광고 재생 중에는 시간 업데이트 차단) */
  const isAdPlaying = useAdWatcher(player, youtubeId);

  // ─── 어드민 전용 핸들러 ───────────────────────────────────────────────────

  /**
   * 광고 재생 중에는 시간 업데이트를 차단하여 싱크 오차를 방지합니다.
   */
  const handleTimeUpdate = useCallback(
    (time: number) => {
      if (!isAdPlaying) onTimeUpdate(time);
    },
    [isAdPlaying, onTimeUpdate],
  );

  /**
   * YouTube URL 또는 ID 입력값에서 11자리 영상 ID를 추출하여 저장합니다.
   */
  const handleYoutubeIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    const match = val.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
    );
    setYoutubeId(match?.[1] ?? val);
  }, []);

  /**
   * 현재 가사와 YouTube ID를 DB에 저장합니다.
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);
    const result = await saveSongData(song.id, { lyrics, youtubeId });
    setIsSaving(false);
    if (result.success) {
      alert("저장되었습니다.");
    } else {
      alert(`저장 실패: ${result.error}`);
    }
  }, [song.id, lyrics, youtubeId]);

  /**
   * LRC 형식 텍스트를 파싱하여 가사를 교체합니다.
   */
  const handleImportLrc = useCallback(() => {
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
  }, [lrcInput, importLyrics]);

  /**
   * 일반 가사 텍스트 드래그 선택 시 말풍선 툴바를 표시합니다.
   * data-line / data-seg 속성을 통해 선택된 세그먼트 위치를 파악합니다.
   */
  const handleMouseUpText = useCallback((e: React.MouseEvent, lineIndex: number) => {
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
  }, []);

  /**
   * 말풍선 툴바에서 텍스트 선택 범위를 Echo 또는 일반 세그먼트로 분리합니다.
   * 선택 전/중/후 텍스트를 각각 별도 세그먼트로 쪼갭니다.
   */
  const handleSplitSegment = useCallback(
    (type: "echo" | "reset") => {
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
      const replacements: LyricSegment[] = [];

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
    },
    [toolbar, lyrics, updateLine],
  );

  /**
   * prompt를 통해 가사 행의 전체 텍스트를 수정합니다.
   * 수정 시 기존 세그먼트 속성이 초기화됩니다.
   */
  const handleEditRawText = useCallback(
    (index: number) => {
      const rawText = lyrics[index].segments.map((s) => s.text).join("");
      const newText = prompt(
        "가사 텍스트를 수정하세요 (기존 세그먼트 속성이 초기화됩니다):",
        rawText,
      );
      if (newText !== null && newText !== rawText) {
        updateLine(index, { segments: [{ text: newText, isCheer: false, isEcho: false }] });
      }
    },
    [lyrics, updateLine],
  );

  /**
   * 현재 재생 시간을 기준으로 특정 세그먼트의 startTimeOffset을 캡처합니다.
   * offset = 현재 재생 시간 - 라인의 startTime (최소 0)
   */
  const captureSegmentOffset = useCallback(
    (lineIndex: number, segmentIndex: number) => {
      const line = lyrics[lineIndex];
      if (!line) return;
      const offset = parseFloat((currentTimeRef.current - line.startTime).toFixed(2));
      const newSegments = [...line.segments];
      newSegments[segmentIndex] = {
        ...newSegments[segmentIndex],
        startTimeOffset: Math.max(0, offset),
      };
      updateLine(lineIndex, { segments: newSegments });
    },
    [lyrics, currentTimeRef, updateLine],
  );

  /**
   * 특정 세그먼트의 속성을 부분 업데이트하는 헬퍼.
   */
  const updateSegment = useCallback(
    (lineIndex: number, segmentIndex: number, partial: Partial<LyricSegment>) => {
      const line = lyrics[lineIndex];
      if (!line) return;
      const newSegments = [...line.segments];
      newSegments[segmentIndex] = { ...newSegments[segmentIndex], ...partial };
      updateLine(lineIndex, { segments: newSegments });
    },
    [lyrics, updateLine],
  );

  /**
   * 현재 선택된 행(currentIndex)의 startTime만 ±offset합니다.
   * currentIndex가 -1이면 아무 동작도 하지 않습니다.
   */
  const applyRowOffset = useCallback(
    (offsetSeconds: number) => {
      if (currentIndex < 0) return;
      const line = lyrics[currentIndex];
      if (!line) return;
      const newTime = Math.max(0, parseFloat((line.startTime + offsetSeconds).toFixed(2)));
      updateLine(currentIndex, { startTime: newTime });
    },
    [currentIndex, lyrics, updateLine],
  );

  return {
    // 가사 편집 (useLyricsEditor 위임)
    lyrics,
    currentIndex,
    setCurrentIndex,
    isRecording,
    setIsRecording,
    subscribeToTime,
    updateLine,
    captureTime,
    addExtraLine,
    addSegmentToExtra,
    removeSegmentFromExtra,
    deleteLine,
    applyGlobalOffset,
    undo,
    redo,
    canUndo,
    canRedo,

    // 어드민 전용 상태
    youtubeId,
    player,
    isSaving,
    isImportOpen,
    lrcInput,
    isAdPlaying,
    toolbar,
    lastAddedTimeRef,

    // 어드민 전용 핸들러
    setPlayer,
    setIsImportOpen,
    setLrcInput,
    setToolbar,
    handleTimeUpdate,
    handleYoutubeIdChange,
    handleSave,
    handleImportLrc,
    handleMouseUpText,
    handleSplitSegment,
    handleEditRawText,
    captureSegmentOffset,
    updateSegment,
    applyRowOffset,
  };
}

/** useAdminEditor의 반환 타입 (Context 타입으로 사용) */
export type AdminEditorStore = ReturnType<typeof useAdminEditor>;
