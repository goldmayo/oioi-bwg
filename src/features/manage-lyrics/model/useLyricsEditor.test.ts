import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useLyricsEditor } from "./useLyricsEditor";

describe("useLyricsEditor", () => {
  const mockLyrics = [
    {
      startTime: 10,
      segments: [{ text: "첫 번째 줄", isCheer: false, isEcho: false }],
      isExtra: false,
    },
    {
      startTime: 20,
      segments: [{ text: "두 번째 줄", isCheer: false, isEcho: false }],
      isExtra: false,
    },
  ];

  it("초기 가사 데이터가 정상적으로 로드되어야 한다", () => {
    const { result } = renderHook(() => useLyricsEditor(mockLyrics));
    expect(result.current.lyrics).toHaveLength(2);
    expect(result.current.lyrics[0].segments[0].text).toBe("첫 번째 줄");
  });

  it("captureTime 호출 시 해당 인덱스의 시간이 현재 시간으로 업데이트되어야 한다", () => {
    const { result } = renderHook(() => useLyricsEditor(mockLyrics));

    // 현재 시간을 15초로 시뮬레이션 (onTimeUpdate 호출)
    act(() => {
      result.current.onTimeUpdate(15);
    });

    // 0번째 행 캡처
    act(() => {
      result.current.captureTime(0);
    });

    expect(result.current.lyrics[0].startTime).toBe(15);
  });

  it("isRecording이 true일 때 캡처하면 다음 행으로 자동으로 넘어가야 한다", () => {
    const { result } = renderHook(() => useLyricsEditor(mockLyrics));

    act(() => {
      result.current.setIsRecording(true);
      result.current.onTimeUpdate(12);
    });

    act(() => {
      result.current.captureTime(0);
    });

    // 캡처 후 currentIndex가 1로 증가했는지 확인
    expect(result.current.currentIndex).toBe(1);
  });

  it("undo와 redo가 정상적으로 동작해야 한다", async () => {
    const { result } = renderHook(() => useLyricsEditor(mockLyrics));

    // 1. 시간 변경 (이제 초기 상태가 history[0]에 있으므로, 이 변경은 history[1]이 됨)
    act(() => {
      result.current.onTimeUpdate(50);
      result.current.captureTime(0);
    });
    expect(result.current.lyrics[0].startTime).toBe(50);

    // 2. Undo 실행 (history[0]인 초기 상태로 복구)
    act(() => {
      result.current.undo();
    });
    expect(result.current.lyrics[0].startTime).toBe(10);

    // 3. Redo 실행 (history[1]인 변경 상태로 복구)
    act(() => {
      result.current.redo();
    });
    expect(result.current.lyrics[0].startTime).toBe(50);
  });

  it("addExtraLine 호출 시 현재 행 다음에 새로운 행이 삽입되어야 한다", () => {
    const { result } = renderHook(() => useLyricsEditor(mockLyrics));

    act(() => {
      result.current.onTimeUpdate(15);
      result.current.addExtraLine(0);
    });

    // mockLyrics[0] (10s) -> newLine (10.1s) -> mockLyrics[1] (20s)
    expect(result.current.lyrics).toHaveLength(3);
    expect(result.current.lyrics[1].isExtra).toBe(true);
    expect(result.current.lyrics[1].startTime).toBe(10.1); // afterIndex가 있으면 index.startTime + 0.1
  });
});
