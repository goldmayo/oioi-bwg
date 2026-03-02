import { z } from "zod";

/**
 * LyricSegmentSchema: 가사 한 줄 내의 특정 텍스트 조각
 */
export const LyricSegmentSchema = z.object({
  text: z.string().min(1, "가사 내용을 입력해주세요."),
  isCheer: z.boolean().default(false), // 하이라이트 여부
  isEcho: z.boolean().default(false),  // 가사를 따라 하는 부분
});

/**
 * LyricLineSchema: 가사 한 줄의 데이터 구조 및 검증 규칙
 */
export const LyricLineSchema = z.object({
  startTime: z.number().min(0, "시간은 0보다 커야 합니다."),
  segments: z.array(LyricSegmentSchema),
  isExtra: z.boolean().default(false), // [Type B] 원곡 가사에 없는 추임새 (독립된 행)
});

/**
 * LyricsDataSchema: 전체 가사 데이터 구조 (배열)
 */
export const LyricsDataSchema = z.array(LyricLineSchema);

// TypeScript 타입 추론
export type LyricSegment = z.infer<typeof LyricSegmentSchema>;
export type LyricLine = z.infer<typeof LyricLineSchema>;
export type LyricsData = z.infer<typeof LyricsDataSchema>;
