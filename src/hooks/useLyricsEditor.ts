"use client";

import { useCallback, useRef, useState } from "react";

import { LyricLine } from "@/types/lyrics";

/**
 * 가사 에디터의 핵심 상태와 조작 메소드를 제공하는 커스텀 훅.
 *
 * 가사 라인 목록 관리, 녹음 모드, 타임스탬프 캡처, 실행 취소/다시 실행(undo/redo)
 * 히스토리, 글로벌 오프셋 적용 등의 기능을 포함합니다.
 *
 * @param initialLyrics - 초기 가사 라인 배열. 기본값은 빈 배열입니다.
 * @returns 가사 편집에 필요한 상태 및 메소드 집합
 */
export function useLyricsEditor(initialLyrics: LyricLine[] = []) {
  /**
   * 현재 편집 중인 가사 라인 배열.
   * 각 라인은 시작 시간(startTime), 세그먼트(segments), 추가 여부(isExtra)를 포함합니다.
   */
  const [lyrics, setLyrics] = useState<LyricLine[]>(initialLyrics);

  /**
   * 현재 포커스(활성화)된 가사 라인의 인덱스.
   * 녹음 모드에서는 타임스탬프 캡처 후 자동으로 다음 인덱스로 이동합니다.
   */
  const [currentIndex, setCurrentIndex] = useState(0);

  /**
   * 녹음 모드 활성화 여부.
   * `true`인 경우, 타임스탬프 캡처 후 currentIndex가 자동으로 다음 줄로 이동합니다.
   */
  const [isRecording, setIsRecording] = useState(false);

  /**
   * 실행 취소(undo)/다시 실행(redo)을 위한 가사 스냅샷 히스토리 스택.
   * 최대 50개의 스냅샷을 유지하며, 초과 시 가장 오래된 항목을 제거합니다.
   */
  const [history, setHistory] = useState<LyricLine[][]>([]);

  /**
   * 현재 히스토리 스택에서 가리키는 인덱스.
   * `-1`은 히스토리가 없는 초기 상태를 의미합니다.
   */
  const [historyIndex, setHistoryIndex] = useState(-1);

  /**
   * 외부 미디어(오디오/비디오)로부터 실시간으로 업데이트되는 현재 재생 시간(초).
   * 리렌더링 없이 최신 시간을 참조하기 위해 ref로 관리합니다.
   */
  const currentTimeRef = useRef(0);

  /**
   * 현재 재생 시간이 변경될 때 호출될 리스너 함수들의 집합(Set).
   * `subscribeToTime`을 통해 등록하고, `onTimeUpdate` 호출 시 모든 리스너에게 시간을 전달합니다.
   */
  const timeListenersRef = useRef<Set<(time: number) => void>>(new Set());

  /**
   * 외부 미디어 플레이어에서 호출하는 시간 업데이트 핸들러.
   * currentTimeRef를 갱신하고, 등록된 모든 리스너에게 새로운 시간을 전파합니다.
   *
   * @param time - 현재 미디어 재생 시간(초 단위)
   */
  const onTimeUpdate = useCallback((time: number) => {
    currentTimeRef.current = time;
    timeListenersRef.current.forEach((listener) => listener(time));
  }, []);

  /**
   * 현재 재생 시간 변경 이벤트를 구독합니다.
   * 컴포넌트가 언마운트될 때 반환된 클린업 함수를 호출하여 구독을 해제해야 합니다.
   *
   * @param listener - 시간이 변경될 때 호출될 콜백 함수. 인자로 현재 시간(초)을 받습니다.
   * @returns 구독을 해제하는 클린업 함수
   */
  const subscribeToTime = useCallback((listener: (time: number) => void) => {
    timeListenersRef.current.add(listener);
    return () => {
      timeListenersRef.current.delete(listener);
    };
  }, []);

  /**
   * 현재 가사 상태를 히스토리 스택에 저장합니다.
   * historyIndex 이후의 미래 히스토리는 제거되고, 새 스냅샷이 푸시됩니다.
   * 스택 크기가 50을 초과하면 가장 오래된 항목을 제거합니다.
   *
   * @param newLyrics - 저장할 새로운 가사 라인 배열
   */
  const saveToHistory = useCallback(
    (newLyrics: LyricLine[]) => {
      const newHistory = history.slice(0, historyIndex + 1);
      newHistory.push([...newLyrics]);
      if (newHistory.length > 50) newHistory.shift();
      setHistory(newHistory);
      setHistoryIndex(newHistory.length - 1);
    },
    [history, historyIndex],
  );

  /**
   * 특정 인덱스의 가사 라인을 부분적으로 업데이트합니다.
   * 변경 사항은 히스토리에 자동으로 저장됩니다.
   *
   * @param index - 수정할 가사 라인의 인덱스
   * @param partialLine - 업데이트할 LyricLine의 부분 속성 객체
   */
  const updateLine = useCallback(
    (index: number, partialLine: Partial<LyricLine>) => {
      const newLyrics = [...lyrics];
      newLyrics[index] = { ...newLyrics[index], ...partialLine };
      setLyrics(newLyrics);
      saveToHistory(newLyrics);
    },
    [lyrics, saveToHistory],
  );

  /**
   * 특정 인덱스의 가사 라인에 현재 재생 시간을 startTime으로 캡처합니다.
   * 소수점 둘째 자리까지 반올림하여 저장합니다.
   * 녹음 모드(`isRecording`)가 활성화된 경우, 마지막 줄이 아니라면 다음 인덱스로 자동 이동합니다.
   *
   * @param index - 타임스탬프를 캡처할 가사 라인의 인덱스
   */
  const captureTime = useCallback(
    (index: number) => {
      if (index < 0 || index >= lyrics.length) return;

      const newLyrics = [...lyrics];
      newLyrics[index].startTime = parseFloat(currentTimeRef.current.toFixed(2));

      setLyrics(newLyrics);
      saveToHistory(newLyrics);

      if (isRecording && index < lyrics.length - 1) {
        setCurrentIndex(index + 1);
      }
    },
    [lyrics, isRecording, saveToHistory],
  );

  /**
   * 새로운 추가(extra) 가사 라인을 삽입합니다.
   * `afterIndex`가 주어지면 해당 라인의 startTime + 0.1초에 삽입하고,
   * 그렇지 않으면 현재 재생 시간을 startTime으로 사용합니다.
   * 삽입 후 startTime 기준으로 전체 가사를 정렬합니다.
   *
   * @param afterIndex - 이 라인 다음에 새 라인을 삽입할 기준 인덱스 (선택 사항)
   * @returns 새로 삽입된 라인의 startTime (포커스 식별 용도)
   */
  // 특정 인덱스 뒤에 추가하거나, 인덱스가 없으면 현재 시간에 맞춰 추가
  const addExtraLine = useCallback(
    (afterIndex?: number) => {
      let time = 0;
      if (afterIndex !== undefined && lyrics[afterIndex]) {
        time = lyrics[afterIndex].startTime + 0.1; // 기준 행보다 0.1초 뒤
      } else {
        time = parseFloat(currentTimeRef.current.toFixed(2));
      }

      const newLine: LyricLine = {
        startTime: time,
        segments: [{ text: "", isCheer: true, isEcho: false }],
        isExtra: true,
      };

      let newIndex = 0;
      setLyrics((prev) => {
        const newLyrics = [...prev, newLine].sort((a, b) => a.startTime - b.startTime);
        newIndex = newLyrics.findIndex((l) => l === newLine);
        saveToHistory(newLyrics);
        return newLyrics;
      });

      setCurrentIndex(newIndex);
      return time; // 포커스 식별용으로 시간 반환
    },
    [lyrics, saveToHistory],
  );

  /**
   * 특정 인덱스의 가사 라인을 삭제합니다.
   * 삭제 후 currentIndex가 마지막 인덱스를 초과하면 마지막 유효 인덱스로 조정됩니다.
   * 변경 사항은 히스토리에 자동으로 저장됩니다.
   *
   * @param index - 삭제할 가사 라인의 인덱스
   */
  const deleteLine = useCallback(
    (index: number) => {
      setLyrics((prev) => {
        const newLyrics = prev.filter((_, i) => i !== index);
        saveToHistory(newLyrics);
        return newLyrics;
      });
      if (currentIndex >= lyrics.length - 1) {
        setCurrentIndex(Math.max(0, lyrics.length - 2));
      }
    },
    [currentIndex, lyrics.length, saveToHistory],
  );

  /**
   * `isExtra` 라인에 새로운 빈 세그먼트를 추가합니다.
   * 대상 라인이 `isExtra`가 아닌 경우 아무 작업도 수행하지 않습니다.
   * 새 세그먼트는 빈 텍스트, `isCheer: true`, `isEcho: false`, `startTimeOffset: 0`으로 초기화됩니다.
   * 변경 사항은 히스토리에 자동으로 저장됩니다.
   *
   * @param index - 세그먼트를 추가할 가사 라인의 인덱스
   */
  const addSegmentToExtra = useCallback(
    (index: number) => {
      const newLyrics = [...lyrics];
      const line = newLyrics[index];
      if (!line.isExtra) return;

      line.segments.push({
        text: "",
        isCheer: true,
        isEcho: false,
        startTimeOffset: 0,
      });
      setLyrics(newLyrics);
      saveToHistory(newLyrics);
    },
    [lyrics, saveToHistory],
  );

  /**
   * `isExtra` 라인에서 특정 인덱스의 세그먼트를 제거합니다.
   * 대상 라인이 `isExtra`가 아닌 경우 아무 작업도 수행하지 않습니다.
   * 세그먼트를 모두 삭제하면 빈 세그먼트 1개(기본값)가 자동으로 유지됩니다.
   * 변경 사항은 히스토리에 자동으로 저장됩니다.
   *
   * @param lineIndex - 대상 가사 라인의 인덱스
   * @param segmentIndex - 제거할 세그먼트의 인덱스
   */
  const removeSegmentFromExtra = useCallback(
    (lineIndex: number, segmentIndex: number) => {
      const newLyrics = [...lyrics];
      const line = newLyrics[lineIndex];
      if (!line.isExtra) return;

      line.segments = line.segments.filter((_, i) => i !== segmentIndex);
      if (line.segments.length === 0) {
        line.segments = [{ text: "", isCheer: true, isEcho: false, startTimeOffset: 0 }];
      }
      setLyrics(newLyrics);
      saveToHistory(newLyrics);
    },
    [lyrics, saveToHistory],
  );

  /**
   * 외부에서 가져온 가사 배열로 현재 가사를 교체합니다.
   * currentIndex를 0으로 초기화하고, 히스토리에 새 상태를 저장합니다.
   *
   * @param newLyrics - 불러올 새 가사 라인의 배열
   */
  const importLyrics = useCallback(
    (newLyrics: LyricLine[]) => {
      setLyrics(newLyrics);
      setCurrentIndex(0);
      saveToHistory(newLyrics);
    },
    [saveToHistory],
  );

  /**
   * 이전 히스토리 상태로 되돌립니다(실행 취소).
   * historyIndex가 0보다 클 때만 동작합니다.
   */
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevLyrics = history[historyIndex - 1];
      setLyrics([...prevLyrics]);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  /**
   * 취소된 작업을 다시 적용합니다(다시 실행).
   * historyIndex가 히스토리 스택의 마지막보다 작을 때만 동작합니다.
   */
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextLyrics = history[historyIndex + 1];
      setLyrics([...nextLyrics]);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

  /**
   * 모든 가사 라인의 startTime에 동일한 오프셋(초)을 더합니다.
   * 결과 시간이 0보다 작으면 0으로 클램핑합니다.
   * 소수점 둘째 자리까지 반올림하며, 변경 사항은 히스토리에 저장됩니다.
   *
   * @param offsetSeconds - 모든 라인에 적용할 시간 오프셋(초 단위, 음수 가능)
   */
  const applyGlobalOffset = useCallback(
    (offsetSeconds: number) => {
      const newLyrics = lyrics.map((line) => ({
        ...line,
        startTime: Math.max(0, parseFloat((line.startTime + offsetSeconds).toFixed(2))),
      }));
      setLyrics(newLyrics);
      saveToHistory(newLyrics);
    },
    [lyrics, saveToHistory],
  );

  return {
    /** 현재 편집 중인 가사 라인 배열 */
    lyrics,
    /** 현재 포커스된 가사 라인의 인덱스 */
    currentIndex,
    /** currentIndex를 직접 변경하는 setter */
    setCurrentIndex,
    /** 녹음 모드 활성화 여부 */
    isRecording,
    /** isRecording 상태를 변경하는 setter */
    setIsRecording,
    /** 외부 미디어의 현재 재생 시간을 담는 ref */
    currentTimeRef,
    /** 미디어 플레이어의 시간 업데이트를 수신하는 핸들러 */
    onTimeUpdate,
    /** 재생 시간 변경 이벤트를 구독하는 함수. 반환값으로 구독 해제 가능 */
    subscribeToTime,
    /** 특정 인덱스의 가사 라인을 부분 업데이트하는 함수 */
    updateLine,
    /** 특정 인덱스의 가사 라인에 현재 재생 시간을 캡처하는 함수 */
    captureTime,
    /** 새로운 추가(extra) 가사 라인을 삽입하는 함수 */
    addExtraLine,
    /** 특정 인덱스의 가사 라인을 삭제하는 함수 */
    deleteLine,
    /** isExtra 라인에 새 빈 세그먼트를 추가하는 함수 */
    addSegmentToExtra,
    /** isExtra 라인의 특정 세그먼트를 제거하는 함수 */
    removeSegmentFromExtra,
    /** 외부 가사 배열을 불러와 교체하는 함수 */
    importLyrics,
    /** 모든 가사 라인의 startTime에 동일한 오프셋을 적용하는 함수 */
    applyGlobalOffset,
    /** 이전 히스토리 상태로 되돌리는 함수 */
    undo,
    /** 취소된 히스토리 상태를 다시 적용하는 함수 */
    redo,
    /** undo 가능 여부 (히스토리가 2개 이상 존재할 때 true) */
    canUndo: historyIndex > 0,
    /** redo 가능 여부 (현재 인덱스가 히스토리 스택 끝이 아닐 때 true) */
    canRedo: historyIndex < history.length - 1,
  };
}
