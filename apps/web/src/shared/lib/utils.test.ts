import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { cn, debounce } from "./utils";

describe("Utils 테스트", () => {
  describe("cn (Right)", () => {
    it("조건문 배열로부터 Tailwind 클래스들을 올바르게 병합하고, 중복 속성은 뒤의 것으로 덮어씌워야 한다", () => {
      expect(cn("bg-red-500", "bg-blue-500")).toBe("bg-blue-500");
      expect(cn("text-sm", true && "font-bold", false && "underline")).toBe("text-sm font-bold");
    });
  });

  describe("debounce (Time - CORRECT)", () => {
    // FakeTimers 설정: 실제 시간이 아닌 모킹된 비동기 시간을 제어
    beforeEach(() => {
      vi.useFakeTimers();
    });

    // 테스트가 끝나면 다른 테스트에 사이드이펙트가 없도록 타이머 원래대로 초기화
    afterEach(() => {
      vi.useRealTimers();
    });

    it("설정된 딜레이 시간 동안 함수가 여러 번 호출되어도, 딜레이 시간이 지나기 전까지는 실행이 무시되고 가장 마지막에만 단 한 번 실행되어야 한다", () => {
      // Given: 모킹된 함수 및 500ms 디바운스 설정
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 500);

      // When: 여러 번 단기간에 호출
      debouncedFn();
      debouncedFn();
      debouncedFn();

      // Then: 즉시 실행되지 않았으므로 호출 횟수는 0이어야 함
      expect(mockFn).not.toHaveBeenCalled();

      // 499ms 경과 후까지는 여전히 실행되지 않아야 함
      vi.advanceTimersByTime(499);
      expect(mockFn).not.toHaveBeenCalled();

      // 1ms 더 경과해서 500ms 를 채우면 그제서야 1번 실행되어야 함
      vi.advanceTimersByTime(1);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});
