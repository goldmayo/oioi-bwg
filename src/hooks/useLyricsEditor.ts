"use client";

import { useCallback, useRef, useState } from "react";

import { LyricLine } from "@/types/lyrics";

export function useLyricsEditor(initialLyrics: LyricLine[] = []) {
  const [lyrics, setLyrics] = useState<LyricLine[]>(initialLyrics);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);

  const [history, setHistory] = useState<LyricLine[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);

  const currentTimeRef = useRef(0);
  const timeListenersRef = useRef<Set<(time: number) => void>>(new Set());

  const onTimeUpdate = useCallback((time: number) => {
    currentTimeRef.current = time;
    timeListenersRef.current.forEach((listener) => listener(time));
  }, []);

  const subscribeToTime = useCallback((listener: (time: number) => void) => {
    timeListenersRef.current.add(listener);
    return () => {
      timeListenersRef.current.delete(listener);
    };
  }, []);

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

  const updateLine = useCallback(
    (index: number, partialLine: Partial<LyricLine>) => {
      const newLyrics = [...lyrics];
      newLyrics[index] = { ...newLyrics[index], ...partialLine };
      setLyrics(newLyrics);
      saveToHistory(newLyrics);
    },
    [lyrics, saveToHistory],
  );

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

  const deleteLine = useCallback((index: number) => {
    setLyrics((prev) => {
      const newLyrics = prev.filter((_, i) => i !== index);
      saveToHistory(newLyrics);
      return newLyrics;
    });
    if (currentIndex >= lyrics.length - 1) {
      setCurrentIndex(Math.max(0, lyrics.length - 2));
    }
  }, [currentIndex, lyrics.length, saveToHistory]);

  const importLyrics = useCallback(
    (newLyrics: LyricLine[]) => {
      setLyrics(newLyrics);
      setCurrentIndex(0);
      saveToHistory(newLyrics);
    },
    [saveToHistory],
  );

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const prevLyrics = history[historyIndex - 1];
      setLyrics([...prevLyrics]);
      setHistoryIndex(historyIndex - 1);
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const nextLyrics = history[historyIndex + 1];
      setLyrics([...nextLyrics]);
      setHistoryIndex(historyIndex + 1);
    }
  }, [history, historyIndex]);

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
    deleteLine,
    importLyrics,
    applyGlobalOffset,
    undo,
    redo,
    canUndo: historyIndex > 0,
    canRedo: historyIndex < history.length - 1,
  };
}
