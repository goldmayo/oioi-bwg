import { createQueryKeys } from "@lukemorales/query-key-factory";
import { z } from "zod";

import { albumDetailSchema } from "./album";

/** RSC seed와 Client Query가 공유하는 isomorphic Song cache identity다. */
export const songQueryKeys = createQueryKeys("song", {
  adminList: null,
  detail: (slug: string) => [slug],
});

export const songSlugParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

export const adminSongIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
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

const adminSongFieldsSchema = z.object({
  albumId: z.number().int().positive(),
  title: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/),
  youtubeId: z.string().trim().min(1),
  hasOfficialCheer: z.boolean(),
  isTitle: z.boolean(),
  isVisible: z.boolean(),
  order: z.number().int(),
});

export const createAdminSongSchema = adminSongFieldsSchema.extend({
  lrcText: z.string().trim().min(1),
});

export const updateAdminSongSchema = adminSongFieldsSchema.extend({
  lrcText: z.string().optional(),
});

export const saveAdminSongLyricsSchema = z.object({
  lyrics: lyricsDataSchema,
  youtubeId: z.string().trim(),
});

export const adminSongSummarySchema = adminSongFieldsSchema.extend({
  id: z.number().int().positive(),
  updatedAt: z.string(),
  album: z.object({ name: z.string() }),
});

export const adminSongMutationResultSchema = z.object({
  id: z.number().int().positive(),
});

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
export type CreateAdminSong = z.infer<typeof createAdminSongSchema>;
export type UpdateAdminSong = z.infer<typeof updateAdminSongSchema>;
export type SaveAdminSongLyrics = z.infer<typeof saveAdminSongLyricsSchema>;
export type AdminSongSummary = z.infer<typeof adminSongSummarySchema>;
export type AdminSongMutationResult = z.infer<typeof adminSongMutationResultSchema>;
