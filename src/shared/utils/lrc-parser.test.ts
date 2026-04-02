import { describe, expect, it } from "vitest";

import { formatTime, parseLrc, parseTime, stringifyLrc } from "./lrc-parser";

describe("LRC Parser Utils", () => {
  describe("formatTime (Right, Boundary)", () => {
    it("초 단위 숫자가 분, 초, 밀리초 형식(mm:ss.ms)으로 정확하게 패딩 변환되어야 한다", () => {
      // Given & When
      const time1 = formatTime(65.5);
      const time2 = formatTime(9.05);
      const time3 = formatTime(0);

      // Then (결과 출력값 검사)
      expect(time1).toBe("01:05.50");
      expect(time2).toBe("00:09.05");
      expect(time3).toBe("00:00.00");
    });
  });

  describe("parseTime (Right, Boundary, Error)", () => {
    it("일반적인 mm:ss.ms 형식 문자열을 초 단위 숫자로 올바르게 변환해야 한다", () => {
      expect(parseTime("01:05.50")).toBe(65.5);
      expect(parseTime("00:09.05")).toBe(9.05);
      expect(parseTime("00:00.00")).toBe(0);
    });

    it("밀리초가 3자리인 포맷(mm:ss.mss)이 입력되어도 배율을 스스로 조정하여 정확한 값으로 변환해야 한다", () => {
      // 00:01.123 -> msDivider 1000 이 적용되어 1.123초 반환
      expect(parseTime("00:01.123")).toBe(1.123);
    });

    it("유효하지 않은 문자열이 입력되면 실수를 기본 파싱하거나 0을 반환하여 에러에 방어해야 한다", () => {
      expect(parseTime("invalid_time_string")).toBe(0);
      expect(parseTime("12.55")).toBe(12.55);
    });
  });

  describe("parseLrc (Conformance, Boundary, Cross-check)", () => {
    it("다수의 라인이 섞여 있어도 정상적인 포맷만 가사 배열로 뽑아내며, 순서가 섞여도 시간에 맞춰 오름차순으로 정렬해야 한다", () => {
      // Given: 순서가 꼬여있고, [Invalid] 포맷이 섞인 문자열
      const lrcText = `
[00:02.50] 두번째 가사입니다.
[Invalid] 쓰레기 데이터
[00:01.00] 첫번째 가사입니다.
      `;

      // When
      const result = parseLrc(lrcText);

      // Then
      expect(result).toHaveLength(2); // Invalid는 무시되어야 함

      // 순서가 정렬되었는지 확인
      expect(result[0].startTime).toBe(1);
      expect(result[0].segments[0].text).toBe("첫번째 가사입니다.");

      expect(result[1].startTime).toBe(2.5);
      expect(result[1].segments[0].text).toBe("두번째 가사입니다.");
    });
  });

  describe("stringifyLrc (Cross-check)", () => {
    it("파싱된 가사 배열을 다시 stringify 하면 원본 포맷 문자열로 완벽히 복원되어야 한다", () => {
      // Given
      const originalTime = 125.75;
      const lyricsArray = [
        {
          startTime: originalTime,
          segments: [{ text: "가사입니다", isCheer: false, isEcho: false }],
          isExtra: false,
        },
      ];

      // When
      const stringified = stringifyLrc(lyricsArray);

      // Then
      expect(stringified).toBe("[02:05.75] 가사입니다");
    });
  });
});
