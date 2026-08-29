import { z } from "zod";

import { albumDetailSchema } from "./album";

export const songSlugParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

export const lyricSegmentSchema = z.object({
  text: z.string().min(1, "가사 내용을 입력해주세요."),
  isCheer: z.boolean().default(false),
  isEcho: z.boolean().default(false),
  startTimeOffset: z.number().optional(),
});

export const lyricLineSchema = z.object({
  startTime: z.number().min(0, "시간은 0보다 커야 합니다."),
  segments: z.array(lyricSegmentSchema),
  isExtra: z.boolean().default(false),
});

export const lyricsDataSchema = z.array(lyricLineSchema);

export const songDetailSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  slug: z.string(),
  youtubeId: z.string(),
  lyrics: lyricsDataSchema,
  hasOfficialCheer: z.boolean(),
  isTitle: z.boolean(),
  order: z.number().int(),
  album: albumDetailSchema,
});

export type LyricSegment = z.infer<typeof lyricSegmentSchema>;
export type LyricLine = z.infer<typeof lyricLineSchema>;
export type LyricsData = z.infer<typeof lyricsDataSchema>;
export type SongDetail = z.infer<typeof songDetailSchema>;
