import { z } from "zod";

import { SongListSchema } from "./song.schema";

/**
 * Base 스키마 — DB 스키마를 미러링하는 순수 API 명세
 * ORM에 의존하지 않으며, BE/FE 모두 이 파일만 참조합니다.
 */
export const BaseAlbumSchema = z.object({
  id: z.number(),
  name: z.string(),
  slug: z.string(),
  imgUrl: z.string(),
  color: z.string(),
  releaseDate: z.string().nullable(),
  isVisible: z.boolean(),
  createdAt: z.string(),
});

/** GET /albums — 목록 아이템 (createdAt 제외) */
export const AlbumListSchema = BaseAlbumSchema.omit({ createdAt: true });
export type AlbumList = z.infer<typeof AlbumListSchema>;

/** GET /albums/:slug — 단건 (songs 포함, createdAt 제외) */
export const AlbumSchema = AlbumListSchema.extend({
  songs: z.array(SongListSchema),
});
export type Album = z.infer<typeof AlbumSchema>;

/** POST /albums — 생성 요청 */
export const CreateAlbumRequestSchema = BaseAlbumSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  name: z.string().min(1, "앨범 이름을 입력해주세요."),
  slug: z
    .string()
    .min(1, "슬러그를 입력해주세요.")
    .regex(/^[a-z0-9-]+$/, "슬러그는 소문자, 숫자, 하이픈만 가능합니다."),
  imgUrl: z.string().url("올바른 이미지 URL을 입력해주세요."),
  color: z
    .string()
    .regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, "올바른 색상 코드를 입력해주세요 (#RRGGBB)."),
  releaseDate: z.string().optional(),
  isVisible: z.boolean().default(true),
});
export type CreateAlbumRequest = z.infer<typeof CreateAlbumRequestSchema>;
