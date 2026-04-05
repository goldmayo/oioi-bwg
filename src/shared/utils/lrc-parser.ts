import { LyricLine } from "@/shared/types/lyrics";

export function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
}

export function parseTime(timeStr: string): number {
  const match = timeStr.match(/(?:(\d+):)?(\d+)[.:](\d+)/);
  if (!match) return parseFloat(timeStr) || 0;

  const minutes = parseInt(match[1] || "0", 10);
  const seconds = parseInt(match[2], 10);
  const milliseconds = parseInt(match[3], 10);
  const msDivider = match[3].length === 3 ? 1000 : 100;

  return minutes * 60 + seconds + milliseconds / msDivider;
}

/**
 * .lrc 형식의 텍스트를 LyricLine[] 배열로 변환합니다.
 * 형식 예: [01:12.50] 가사 내용
 */
export function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split("\n");
  const result: LyricLine[] = [];

  const timeRegex = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const milliseconds = parseInt(match[3], 10);
      const msDivider = match[3].length === 3 ? 1000 : 100;
      const startTime = minutes * 60 + seconds + milliseconds / msDivider;

      const text = line.replace(timeRegex, "").trim();

      if (text) {
        result.push({
          startTime,
          segments: [{ text, isCheer: false, isEcho: false }],
          isExtra: false,
        });
      }
    }
  }

  return result.sort((a, b) => a.startTime - b.startTime);
}

/**
 * LyricLine[] 배열을 .lrc 형식의 텍스트로 변환합니다. (내보내기용)
 */
export function stringifyLrc(lyrics: LyricLine[]): string {
  return lyrics
    .map((line) => {
      const timestamp = `[${formatTime(line.startTime)}]`;
      const fullText = line.segments.map((s) => s.text).join("");
      return `${timestamp} ${fullText}`;
    })
    .join("\n");
}
