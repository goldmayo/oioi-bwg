import { act, renderHook } from "@testing-library/react";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { saveSongData } from "@/features/manage-lyrics/actions";

import { useAdminEditor } from "./useAdminEditor";

// 서버 액션 모킹
vi.mock("@/features/manage-lyrics/actions", () => ({
  saveSongData: vi.fn(),
}));

const mockAlert = vi.fn();
const mockPrompt = vi.fn();
const originalAlert = global.alert;
const originalPrompt = global.prompt;

describe("useAdminEditor 훅 테스트", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.alert = mockAlert;
    global.prompt = mockPrompt;
  });

  afterAll(() => {
    global.alert = originalAlert;
    global.prompt = originalPrompt;
    vi.restoreAllMocks();
  });

  const mockSong = {
    id: 1,
    title: "Test Song",
    youtubeId: "test_initial_id",
    lyrics: [
      {
        startTime: 10,
        isExtra: false,
        segments: [
          { text: "첫 번째 가사 라인입니다", isCheer: false, isEcho: false, startTimeOffset: 0 },
        ],
      },
      {
        startTime: 20,
        isExtra: false,
        segments: [{ text: "두 번째 가사", isCheer: false, isEcho: false, startTimeOffset: 0 }],
      },
    ],
  };

  describe("handleYoutubeIdChange (Right-BICEP - Boundary)", () => {
    it("일반적인 유튜브 URL부터 아주 복잡한 쿼리 파라미터가 섞인 URL까지 11자리 ID를 정확히 파싱해야 한다", () => {
      const { result } = renderHook(() => useAdminEditor(mockSong));

      // 1. 일반 웹 유튜브 URL
      act(() => {
        result.current.handleYoutubeIdChange({
          target: { value: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
        } as never);
      });
      expect(result.current.youtubeId).toBe("dQw4w9WgXcQ");

      // 2. youtu.be 축약된 URL + 기타 파라미터
      act(() => {
        result.current.handleYoutubeIdChange({
          target: { value: "https://youtu.be/kffacxfA7G4?si=123" },
        } as never);
      });
      expect(result.current.youtubeId).toBe("kffacxfA7G4");

      // 3. ID 단독문자열 일 때 그대로 반환 (Fallback)
      act(() => {
        result.current.handleYoutubeIdChange({ target: { value: "just_id_123" } } as never);
      });
      expect(result.current.youtubeId).toBe("just_id_123");
    });
  });

  describe("handleSplitSegment (Cross-check - 교차 검증)", () => {
    it("말풍선 툴바에서 텍스트를 드래그하고 분리 버튼을 누르면, 세그먼트가 3분할되며 합쳤을 때 원본 텍스트 길이를 일치해야 한다", () => {
      const { result } = renderHook(() => useAdminEditor(mockSong));

      // Given: 0번째의 가사를 분할할 수동 툴바 State 셋팅 ("첫 번째"를 드래그했다고 시뮬레이션)
      // "첫 번째 가사 라인입니다" => 앞: "첫 ", 중간(선택): "번째", 뒤: " 가사 라인입니다"
      act(() => {
        result.current.setToolbar({
          show: true,
          x: 0,
          y: 0,
          lineIndex: 0,
          segmentIndex: 0, // 원래는 1개짜리 통 세그먼트
          startOffset: 2, // "첫 "의 끝 위치
          endOffset: 4, // "번째"가 끝나는 위치
        });
      });

      // When: "echo" 타입으로 자르기 실행
      act(() => {
        result.current.handleSplitSegment("echo");
      });

      // Then: 배열이 3등분으로 쪼개져야 함
      const newSegments = result.current.lyrics[0].segments;
      expect(newSegments).toHaveLength(3);
      expect(newSegments[0].text).toBe("첫 ");
      expect(newSegments[1].text).toBe("번째");
      expect(newSegments[1].isEcho).toBe(true); // echo옵션을 주었으므로
      expect(newSegments[2].text).toBe(" 가사 라인입니다");

      // Cross-check: 각 요소 분할 합이 원본 길이랑 같은지 검증
      const totalText = newSegments.reduce((acc, curr) => acc + curr.text, "");
      expect(totalText).toBe("첫 번째 가사 라인입니다");

      // 작업 완료 후 툴바는 해제되어야 함
      expect(result.current.toolbar).toBeNull();
    });
  });

  describe("applyRowOffset (Range/Boundary)", () => {
    it("선택된 가사 행의 시간(인덱스 위치) 만 오프셋이 반영되어야 하고, 결과가 음수일 경우 안전하게 0초를 유지해야 한다", () => {
      const { result } = renderHook(() => useAdminEditor(mockSong));

      // 현재 선택된 인덱스는 0번 초기 상태. 시간이 10.
      act(() => {
        result.current.applyRowOffset(5.5);
      });
      expect(result.current.lyrics[0].startTime).toBe(15.5); // 정상 연산

      act(() => {
        result.current.applyRowOffset(-25); // 15.5 - 25 = 음수 -> 0
      });
      expect(result.current.lyrics[0].startTime).toBe(0); // 경계값 방어 성공
    });
  });

  describe("handleSave (Inverse / Error 처리)", () => {
    it("저장이 성공적으로 이루어질 경우 Success Alert를, 에러가 발생하면 실패 에러 Alert를 다르게 발생시켜야 한다", async () => {
      const { result } = renderHook(() => useAdminEditor(mockSong));

      // Success 케이스
      vi.mocked(saveSongData).mockResolvedValueOnce({ success: true, count: 1 } as never);

      await act(async () => {
        await result.current.handleSave();
      });

      expect(saveSongData).toHaveBeenCalled();
      expect(mockAlert).toHaveBeenCalledWith("저장되었습니다.");

      // Error 케이스
      vi.mocked(saveSongData).mockResolvedValueOnce({
        success: false,
        error: "Network Timeout",
      } as never);

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockAlert).toHaveBeenCalledWith("저장 실패: Network Timeout");
    });
  });
});
