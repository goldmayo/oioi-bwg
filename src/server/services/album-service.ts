import "server-only";

import type {
  AlbumDetail,
  AlbumSummary,
  RenderableAlbumSong,
  SaveAdminAlbum,
} from "@/shared/contracts/album";

import { type RequestContext, requireUser } from "../auth/request-context";
import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import {
  findAlbumBySlug,
  findAllAlbums,
  findVisibleAlbumsWithSongs,
  insertAlbum,
  removeAlbum,
  updateAlbum,
} from "../repositories/album-repository";

type AlbumPersistenceRow = Awaited<ReturnType<typeof findAllAlbums>>[number];
type AlbumWithSongsPersistenceRow = Awaited<ReturnType<typeof findVisibleAlbumsWithSongs>>[number];
type AlbumSongPersistenceRow = AlbumWithSongsPersistenceRow["songs"][number];

function mapAlbum(row: AlbumPersistenceRow): AlbumSummary {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    imgUrl: row.imgUrl,
    color: row.color,
    releaseDate: row.releaseDate,
    isVisible: row.isVisible,
    createdAt: row.createdAt,
  };
}

function mapRenderableSong(song: AlbumSongPersistenceRow): RenderableAlbumSong | null {
  const { title, slug, youtubeId } = song;
  if (!title || !slug || youtubeId === null) return null;

  return {
    ...song,
    title,
    slug,
    youtubeId,
    hasOfficialCheer: song.hasOfficialCheer ?? false,
  };
}

function mapAlbumWithRenderableSongs(album: AlbumWithSongsPersistenceRow): AlbumDetail {
  return {
    ...mapAlbum(album),
    songs: album.songs.flatMap((song) => {
      const mapped = mapRenderableSong(song);
      return mapped ? [mapped] : [];
    }),
  };
}

export async function listVisibleAlbumsWithSongs() {
  const rows = await findVisibleAlbumsWithSongs(getDatabase());
  return rows.map(mapAlbumWithRenderableSongs);
}

export async function getAlbumDetailBySlug(slug: string) {
  const row = await findAlbumBySlug(getDatabase(), slug);
  return row ? mapAlbumWithRenderableSongs(row) : undefined;
}

/** HTTP 전달 계층이 사용할 공개 앨범 조회 use case다. */
export async function requireAlbumDetailBySlug(slug: string) {
  const album = await getAlbumDetailBySlug(slug);

  if (!album) {
    throw new AppError("ALBUM_NOT_FOUND");
  }

  return album;
}

function requireAdmin(ctx: RequestContext) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
}

export async function listAdminAlbums(ctx: RequestContext): Promise<AlbumSummary[]> {
  requireAdmin(ctx);
  const rows = await findAllAlbums(getDatabase());
  return rows.map(mapAlbum);
}

export async function createAlbum(
  ctx: RequestContext,
  input: SaveAdminAlbum,
): Promise<AlbumSummary> {
  requireAdmin(ctx);
  try {
    const [album] = await insertAlbum(getDatabase(), input);
    if (!album) throw new Error("Album was not created");
    return mapAlbum(album);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Album_slug_key")) {
      throw new AppError("ALBUM_SLUG_ALREADY_EXISTS");
    }
    throw error;
  }
}

export async function editAlbum(
  ctx: RequestContext,
  id: number,
  input: SaveAdminAlbum,
): Promise<AlbumSummary> {
  requireAdmin(ctx);
  try {
    const [album] = await updateAlbum(getDatabase(), id, input);
    if (!album) throw new AppError("ALBUM_NOT_FOUND");
    return mapAlbum(album);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Album_slug_key")) {
      throw new AppError("ALBUM_SLUG_ALREADY_EXISTS");
    }
    throw error;
  }
}

export async function deleteAlbum(ctx: RequestContext, id: number) {
  requireAdmin(ctx);
  const [album] = await removeAlbum(getDatabase(), id);
  if (!album) throw new AppError("ALBUM_NOT_FOUND");
}
