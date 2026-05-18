import { z } from "zod";

import { LyricsDataSchema } from "./lyrics.schema";

/**
 * Base 스키마 — DB 스키마를 미러링하는 순수 API 명세
 * ORM에 의존하지 않으며, BE/FE 모두 이 파일만 참조합니다.
 */
export const BaseSongSchema = z.object({
  id: z.number(),
  albumId: z.number(),
  title: z.string(),
  youtubeId: z.string(),
  lyrics: LyricsDataSchema,
  hasOfficialCheer: z.boolean(),
  isTitle: z.boolean(),
  isVisible: z.boolean(),
  order: z.number(),
  createdAt: z.string(),
  updatedAt: z.string(),
  slug: z.string(),
});

/** GET /songs — 가사를 제외한 목록 아이템 */
export const SongListSchema = BaseSongSchema.pick({
  id: true,
  title: true,
  slug: true,
  albumId: true,
  order: true,
  updatedAt: true,
  hasOfficialCheer: true,
  isTitle: true,
  isVisible: true,
});
export type SongList = z.infer<typeof SongListSchema>;

/** GET /songs/:slug — 단건 (lyrics 포함) */
export const SongSchema = BaseSongSchema.omit({ createdAt: true });
export type Song = z.infer<typeof SongSchema>;

/** POST /songs — 생성 요청 */
export const CreateSongRequestSchema = BaseSongSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  title: z.string().min(1, "제목을 입력해주세요."),
  slug: z.string().min(1, "슬러그를 입력해주세요."),
  youtubeId: z.string().min(1, "유튜브 ID를 입력해주세요."),
  albumId: z.number().int().positive("앨범을 선택해주세요."),
  hasOfficialCheer: z.boolean().default(false),
  isTitle: z.boolean().default(false),
  isVisible: z.boolean().default(true),
  order: z.number().int().default(0),
});
export type CreateSongRequest = z.infer<typeof CreateSongRequestSchema>;
