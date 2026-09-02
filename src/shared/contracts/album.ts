import { createQueryKeys } from "@lukemorales/query-key-factory";
import { z } from "zod";

/** RSC seed와 Client Query가 공유하는 isomorphic Album cache identity다. */
export const albumQueryKeys = createQueryKeys("album", {
  adminList: null,
  detail: (slug: string) => [slug],
});

export const albumSlugParamsSchema = z.object({
  slug: z.string().trim().min(1),
});

export const adminAlbumIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const saveAdminAlbumSchema = z.object({
  name: z.string().trim().min(1),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9-]+$/),
  imgUrl: z.string().url(),
  color: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
  releaseDate: z.string().nullable(),
  isVisible: z.boolean(),
});

export const renderableAlbumSongSchema = z.object({
  id: z.number().int(),
  title: z.string(),
  slug: z.string(),
  youtubeId: z.string(),
  hasOfficialCheer: z.boolean(),
  isTitle: z.boolean(),
});

export const albumSummarySchema = z.object({
  id: z.number().int(),
  name: z.string(),
  slug: z.string(),
  imgUrl: z.string(),
  color: z.string(),
  releaseDate: z.string().nullable(),
  isVisible: z.boolean(),
  createdAt: z.string(),
});

export const albumDetailSchema = albumSummarySchema.extend({
  songs: z.array(renderableAlbumSongSchema),
});

export type RenderableAlbumSong = z.infer<typeof renderableAlbumSongSchema>;
export type AlbumSummary = z.infer<typeof albumSummarySchema>;
export type AlbumDetail = z.infer<typeof albumDetailSchema>;
export type SaveAdminAlbum = z.infer<typeof saveAdminAlbumSchema>;
