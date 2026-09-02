import "server-only";

import {
  type CreateAdminSong,
  type LyricsData,
  lyricsDataSchema,
  type SaveAdminSongLyrics,
  type SongDetail,
  type UpdateAdminSong,
} from "@/shared/contracts/song";

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

export type CreateSongInput = CreateAdminSong;
export type EditSongInput = UpdateAdminSong;

type PublicSongRow = NonNullable<Awaited<ReturnType<typeof findSongBySlug>>>;
type PublicAlbumSongRow = PublicSongRow["album"]["songs"][number];

function mapRenderableAlbumSong(song: PublicAlbumSongRow) {
  const { title, slug, youtubeId } = song;
  if (!song.isVisible || !title || !slug || youtubeId === null) return null;

  return {
    id: song.id,
    title,
    slug,
    youtubeId,
    hasOfficialCheer: song.hasOfficialCheer ?? false,
    isTitle: song.isTitle,
  };
}

function parseStoredLyrics(value: unknown): LyricsData {
  const parsed = lyricsDataSchema.safeParse(value ?? []);

  if (!parsed.success) {
    throw new Error("Stored song lyrics contract violation", { cause: parsed.error });
  }

  return parsed.data;
}

function mapSongDetail(row: PublicSongRow): SongDetail | undefined {
  const { album, title, slug, youtubeId } = row;
  if (!album.isVisible || !title || !slug || youtubeId === null) return undefined;

  return {
    id: row.id,
    title,
    slug,
    youtubeId,
    lyrics: parseStoredLyrics(row.lyrics),
    hasOfficialCheer: row.hasOfficialCheer ?? false,
    isTitle: row.isTitle,
    order: row.order ?? 0,
    album: {
      id: album.id,
      name: album.name,
      slug: album.slug,
      imgUrl: album.imgUrl,
      color: album.color,
      releaseDate: album.releaseDate,
      isVisible: album.isVisible,
      createdAt: album.createdAt,
      songs: album.songs.flatMap((song) => {
        const mapped = mapRenderableAlbumSong(song);
        return mapped ? [mapped] : [];
      }),
    },
  };
}

export async function getSongDetailBySlug(slug: string) {
  const row = await findSongBySlug(getDatabase(), slug);
  return row ? mapSongDetail(row) : undefined;
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

function parseSongLyrics(lrcText: string) {
  const timestamp = /\[(\d{2}):(\d{2})[.:](\d{2,3})\]/;
  const parsedLines = lrcText.split("\n").flatMap((line) => {
    const match = timestamp.exec(line);
    if (!match) return [];

    const text = line.replace(timestamp, "").trim();
    if (!text) return [];

    const fraction = Number(match[3]) / (match[3].length === 3 ? 1000 : 100);
    return [
      {
        startTime: Number(match[1]) * 60 + Number(match[2]) + fraction,
        segments: [{ text, isCheer: false, isEcho: false }],
        isExtra: false,
      },
    ];
  });
  const lyrics = lyricsDataSchema.parse(parsedLines.sort((a, b) => a.startTime - b.startTime));
  if (lyrics.length === 0) throw new AppError("SONG_LYRICS_INVALID");
  return lyrics;
}

export async function getAdminSongEditorBySlug(ctx: RequestContext, slug: string) {
  requireAdmin(ctx);
  const row = await findAdminSongBySlug(getDatabase(), slug);

  if (!row) return undefined;

  return {
    id: row.id,
    title: row.title ?? "",
    youtubeId: row.youtubeId ?? "",
    lyrics: parseStoredLyrics(row.lyrics),
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
  const { lrcText, ...fields } = input;
  const row = {
    ...fields,
    lyrics: parseSongLyrics(lrcText),
    createdAt: now,
    updatedAt: now,
  };

  return insertSong(getDatabase(), row).then(([song]) => {
    if (!song) throw new Error("Song was not created");
    return song;
  });
}

export async function editSong(ctx: RequestContext, id: number, input: EditSongInput) {
  requireAdmin(ctx);
  const { lrcText, ...fields } = input;
  const row = {
    ...fields,
    ...(lrcText?.trim() ? { lyrics: parseSongLyrics(lrcText) } : {}),
    updatedAt: new Date().toISOString(),
  };

  const [song] = await updateSong(getDatabase(), id, row);
  if (!song) throw new AppError("SONG_NOT_FOUND");
  return song;
}

export async function saveSongLyrics(ctx: RequestContext, id: number, input: SaveAdminSongLyrics) {
  requireAdmin(ctx);
  const [song] = await updateSong(getDatabase(), id, {
    ...input,
    updatedAt: new Date().toISOString(),
  });
  if (!song) throw new AppError("SONG_NOT_FOUND");
  return song;
}

export function deleteSong(ctx: RequestContext, id: number) {
  requireAdmin(ctx);
  return removeSong(getDatabase(), id).then(([song]) => {
    if (!song) throw new AppError("SONG_NOT_FOUND");
  });
}
