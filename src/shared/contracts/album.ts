import { z } from "zod";

export const albumSlugParamsSchema = z.object({
  slug: z.string().trim().min(1),
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
