import "server-only";

import { type RequestContext, requireUser } from "../auth/request-context";
import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import {
  findAdminSongBySlug,
  findSongBySlug,
  findSongsWithAlbum,
  findVisibleSongs,
  insertSong,
  removeSong,
  updateSong,
} from "../repositories/song-repository";

export interface CreateSongInput {
  albumId: number;
  title: string;
  slug: string;
  youtubeId: string;
  lyrics: unknown;
  hasOfficialCheer: boolean;
  isTitle: boolean;
  isVisible: boolean;
  order: number;
}

export interface EditSongInput {
  albumId: number;
  title: string;
  slug: string;
  youtubeId: string;
  hasOfficialCheer: boolean;
  isTitle: boolean;
  isVisible: boolean;
  order: number;
  lyrics?: unknown;
}

function mapRenderableAlbumSong<
  T extends {
    title: string | null;
    slug: string | null;
    youtubeId: string | null;
    hasOfficialCheer: boolean | null;
    order: number | null;
  },
>(song: T) {
  const { title, slug, youtubeId } = song;
  if (!title || !slug || youtubeId === null) return null;

  return {
    ...song,
    title,
    slug,
    youtubeId,
    hasOfficialCheer: song.hasOfficialCheer ?? false,
    order: song.order ?? 0,
  };
}

export async function getSongDetailBySlug(slug: string) {
  const row = await findSongBySlug(getDatabase(), slug);

  if (!row?.title || !row.slug || row.youtubeId === null) return undefined;

  return {
    ...row,
    title: row.title,
    slug: row.slug,
    youtubeId: row.youtubeId,
    hasOfficialCheer: row.hasOfficialCheer ?? false,
    order: row.order ?? 0,
    album: {
      ...row.album,
      songs: row.album.songs.flatMap((song) => {
        const mapped = mapRenderableAlbumSong(song);
        return mapped ? [mapped] : [];
      }),
    },
  };
}

/** HTTP 전달 계층이 사용할 공개 곡 조회 use case다. */
export async function requireSongDetailBySlug(slug: string) {
  const song = await getSongDetailBySlug(slug);

  if (!song) {
    throw new AppError("SONG_NOT_FOUND");
  }

  return song;
}

function requireAdmin(ctx: RequestContext) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
}

export async function getAdminSongEditorBySlug(ctx: RequestContext, slug: string) {
  requireAdmin(ctx);
  const row = await findAdminSongBySlug(getDatabase(), slug);

  if (!row) return undefined;

  return {
    ...row,
    title: row.title ?? "",
    youtubeId: row.youtubeId ?? "",
    lyrics: row.lyrics ?? [],
  };
}

export async function listVisibleSongsForSitemap() {
  const rows = await findVisibleSongs(getDatabase());

  return rows.flatMap((song) => {
    if (!song.title || !song.slug || !song.updatedAt) return [];

    return [
      {
        ...song,
        title: song.title,
        slug: song.slug,
        updatedAt: song.updatedAt,
        hasOfficialCheer: song.hasOfficialCheer ?? false,
        order: song.order ?? 0,
      },
    ];
  });
}

export async function listAdminSongs(ctx: RequestContext) {
  requireAdmin(ctx);
  const rows = await findSongsWithAlbum(getDatabase());

  return rows.map((song) => ({
    ...song,
    title: song.title ?? "",
    slug: song.slug ?? "",
    youtubeId: song.youtubeId ?? "",
    order: song.order ?? 0,
    updatedAt: song.updatedAt ?? "",
    hasOfficialCheer: song.hasOfficialCheer ?? false,
  }));
}

export function createSong(ctx: RequestContext, input: CreateSongInput) {
  requireAdmin(ctx);
  const now = new Date().toISOString();
  const row = {
    ...input,
    createdAt: now,
    updatedAt: now,
  };

  return insertSong(getDatabase(), row);
}

export function editSong(ctx: RequestContext, id: number, input: EditSongInput) {
  requireAdmin(ctx);
  const row = {
    ...input,
    updatedAt: new Date().toISOString(),
  };

  return updateSong(getDatabase(), id, row);
}

export function saveSongLyrics(
  ctx: RequestContext,
  id: number,
  input: { lyrics: unknown; youtubeId: string },
) {
  requireAdmin(ctx);
  return updateSong(getDatabase(), id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
}

export function deleteSong(ctx: RequestContext, id: number) {
  requireAdmin(ctx);
  return removeSong(getDatabase(), id);
}
