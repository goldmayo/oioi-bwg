import { listVisibleAlbumsWithSongs } from "@oioi-bwg/server/services/album-service";
import { listVisibleSongsForSitemap } from "@oioi-bwg/server/services/song-service";
import { MetadataRoute } from "next";

import { SITE_CONFIG } from "@/shared/config/site";

export const dynamic = "force-dynamic";

/** 실제 공개 reader가 제공하는 URL만 검색 엔진에 알린다. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [songs, albums] = await Promise.all([
    listVisibleSongsForSitemap(),
    listVisibleAlbumsWithSongs(),
  ]);
  const url = (path: string) => new URL(path, SITE_CONFIG.url).toString();

  return [
    ...["/", "/chants", "/more", "/more/notice", "/more/updates", "/more/policy"].map((path) => ({
      url: url(path),
    })),
    ...albums.map((album) => ({ url: url(`/albums/${encodeURIComponent(album.slug)}`) })),
    ...songs.map((song) => {
      const lastModified = song.updatedAt ? new Date(song.updatedAt) : undefined;
      return {
        url: url(`/songs/${encodeURIComponent(song.slug)}`),
        ...(lastModified && !Number.isNaN(lastModified.getTime()) ? { lastModified } : {}),
      };
    }),
  ];
}
