export interface LyricLine {
  startTime: number; // 재생 시작 시간 (초)
  text: string;      // 가사 내용

  isCheer: boolean;  // [기본 응원] true면 하이라이트 (예: 마젠타 컬러)
  isEcho: boolean;   // [Type A: 에코] 가사를 따라 하는 부분
  isExtra: boolean;  // [Type B: 추임새] 원곡 가사에 없는 팬들의 함성 (네임콜 등)
}

export type LyricsData = LyricLine[];
