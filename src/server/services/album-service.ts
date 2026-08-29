import "server-only";

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

export interface SaveAlbumInput {
  name: string;
  slug: string;
  imgUrl: string;
  color: string;
  releaseDate: string | null;
  isVisible: boolean;
}

export interface AlbumDto {
  id: number;
  name: string;
  slug: string;
  imgUrl: string;
  color: string;
  releaseDate: string | null;
  isVisible: boolean;
  createdAt: string;
}

type AlbumPersistenceRow = Awaited<ReturnType<typeof findAllAlbums>>[number];
type AlbumWithSongsPersistenceRow = Awaited<ReturnType<typeof findVisibleAlbumsWithSongs>>[number];
type AlbumSongPersistenceRow = AlbumWithSongsPersistenceRow["songs"][number];

export interface AlbumSongDto {
  id: number;
  title: string;
  slug: string;
  youtubeId: string;
  hasOfficialCheer: boolean;
  isTitle: boolean;
}

export interface AlbumWithSongsDto extends AlbumDto {
  songs: AlbumSongDto[];
}

function mapAlbum(row: AlbumPersistenceRow): AlbumDto {
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

function mapRenderableSong(song: AlbumSongPersistenceRow): AlbumSongDto | null {
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

function mapAlbumWithRenderableSongs(album: AlbumWithSongsPersistenceRow): AlbumWithSongsDto {
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

export async function listAdminAlbums(): Promise<AlbumDto[]> {
  const rows = await findAllAlbums(getDatabase());
  return rows.map(mapAlbum);
}

export function createAlbum(input: SaveAlbumInput) {
  return insertAlbum(getDatabase(), input);
}

export function editAlbum(id: number, input: SaveAlbumInput) {
  return updateAlbum(getDatabase(), id, input);
}

export function deleteAlbum(id: number) {
  return removeAlbum(getDatabase(), id);
}
