import { LyricLine, LyricsData } from "../types/lyrics";

/**
 * LRC 형식의 문자열을 LyricLine[] 형식으로 변환합니다.
 * 피드백 반영: 다중 타임스탬프 지원, ms 정밀도 보정, 빈 가사 유지.
 * 모든 응원 관련 플래그(isCheer, isEcho, isExtra)는 사용자가 직접 제어하도록 false로 초기화합니다.
 */
export function parseLRC(lrc: string): LyricsData {
  const lines = lrc.split("\n");
  const result: LyricLine[] = [];

  // 다중 매칭을 위해 g 플래그 사용
  const timeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{1,3}))?\]/g;

  lines.forEach((line) => {
    const matches = Array.from(line.matchAll(timeRegex));
    if (matches.length === 0) return;

    // 모든 타임스탬프를 제거한 순수 가사 추출
    const text = line.replace(timeRegex, "").trim();

    matches.forEach((match) => {
      const minutes = parseInt(match[1]);
      const seconds = parseInt(match[2]);
      
      // ms 자릿수를 3자리로 보정 (예: .5 -> 500, .50 -> 500)
      const msStr = (match[3] || "0").padEnd(3, "0");
      const milliseconds = parseInt(msStr.slice(0, 3));

      const startTime = parseFloat((minutes * 60 + seconds + milliseconds / 1000).toFixed(3));

      result.push({
        startTime,
        text: text || "", // 빈 가사도 유지하여 화면 클리어용으로 사용
        isCheer: false,
        isEcho: false,  // 자동 판단 제거: 사용자가 직접 설정
        isExtra: false,
      });
    });
  });

  return result.sort((a, b) => a.startTime - b.startTime);
}

/**
 * LyricLine[] 데이터를 다시 LRC 문자열로 변환합니다. (내보내기용)
 */
export function stringifyLRC(data: LyricsData): string {
  return data
    .map((line) => {
      const m = Math.floor(line.startTime / 60);
      const s = Math.floor(line.startTime % 60);
      const ms = Math.floor((line.startTime % 1) * 100);
      
      const timeStr = `[${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms
        .toString()
        .padStart(2, "0")}]`;
      return `${timeStr} ${line.text}`;
    })
    .join("\n");
}
