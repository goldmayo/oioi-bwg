import "server-only";

import {
  type AdminSongList,
  type CreateAdminSong,
  type LyricsData,
  lyricsDataSchema,
  publishedCheerGuideSchema,
  type SaveAdminSongLyrics,
  type SongDetail,
  type UpdateAdminSong,
} from "@oioi-bwg/contracts/song";

import {
  type AuthenticatedRequestContext,
  type RequestContext,
  requireUser,
} from "../auth/request-context";
import { getDatabase } from "../db";
import { AppError } from "../errors/app-error";
import { SongSlugConflictError, CheerGuideReferenceError } from "../repositories/repository-error";
import {
  findAdminSongBySlug,
  findSongBySlug,
  findSongsWithAlbum,
  findVisibleSongs,
  insertSong,
  removeSong,
  updateSong,
  updateSongWithSlugPolicy,
} from "../repositories/song-repository";

import { lockSongForGuideWrite } from "../repositories/cheer-guide-repository";
import {
  currentPublishedGuides,
  defaultGuideIsOfficial,
  hasGuidePublication,
} from "./cheer-guide-read";
import { writeLegacyGuide } from "./cheer-guide-write-service";

function guideVersion(row: { guideId?: string | null; guideLockVersion?: number | null }) {
  return row.guideId && row.guideLockVersion
    ? { guideWrite: { guideId: row.guideId, lockVersion: row.guideLockVersion } }
    : {};
}

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
    hasOfficialCheer: defaultGuideIsOfficial(song.cheerGuides, youtubeId, song.hasOfficialCheer),
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

function mapPublicCheering(row: PublicSongRow, youtubeId: string) {
  if (!hasGuidePublication(row.cheerGuides))
    return {
      lyrics: parseStoredLyrics(row.lyrics),
      hasOfficialCheer: row.hasOfficialCheer ?? false,
    };
  const cheerGuides = currentPublishedGuides(row.cheerGuides, youtubeId).map(
    ({ id, mode, snapshot }) => {
      const parsed = publishedCheerGuideSchema.safeParse({
        id,
        mode,
        lyrics: snapshot.lyrics,
        sourceType: snapshot.sourceType,
        sourceUrl: snapshot.sourceUrl,
        guideVideoUrl: snapshot.guideVideoUrl,
        description: snapshot.description,
      });
      if (!parsed.success)
        throw new Error("Stored cheer guide contract violation", { cause: parsed.error });
      return parsed.data;
    },
  );
  return {
    cheerGuides,
    lyrics: cheerGuides[0]?.lyrics ?? [],
    hasOfficialCheer: cheerGuides[0]?.sourceType === "OFFICIAL",
  };
}

function mapSongDetail(row: PublicSongRow): SongDetail | undefined {
  const { album, title, slug, youtubeId } = row;
  if (!album.isVisible || !title || !slug || youtubeId === null) return undefined;

  return {
    id: row.id,
    title,
    slug,
    youtubeId,
    ...mapPublicCheering(row, youtubeId),
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

function requireAdmin(ctx: RequestContext): asserts ctx is AuthenticatedRequestContext {
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
    ...guideVersion(row),
  };
}

export async function listVisibleSongsForSitemap() {
  const rows = await findVisibleSongs(getDatabase());

  return rows.flatMap((song) => {
    if (!song.album.isVisible || !song.title || !song.slug || song.youtubeId === null) return [];
    return [{ slug: song.slug, updatedAt: song.updatedAt }];
  });
}

export async function listAdminSongs(ctx: RequestContext): Promise<AdminSongList> {
  requireAdmin(ctx);
  const rows = await findSongsWithAlbum(getDatabase());

  return {
    items: rows.map(({ guideId, guideLockVersion, ...song }) => ({
      ...guideVersion({ guideId, guideLockVersion }),
      ...song,
      title: song.title ?? "",
      slug: song.slug,
      youtubeId: song.youtubeId ?? "",
      order: song.order ?? 0,
      updatedAt: song.updatedAt ?? "",
      hasOfficialCheer: song.hasOfficialCheer ?? false,
    })),
    nextCursor: null,
  };
}

export function createSong(ctx: RequestContext, input: CreateAdminSong) {
  requireAdmin(ctx);
  const now = new Date().toISOString();
  const { lrcText, ...fields } = input;
  const row = {
    ...fields,
    lyrics: parseSongLyrics(lrcText),
    createdAt: now,
    updatedAt: now,
  };

  return insertSong(getDatabase(), row)
    .then(([song]) => {
      if (!song) throw new Error("Song was not created");
      return song;
    })
    .catch((error: unknown) => {
      if (error instanceof SongSlugConflictError) {
        throw new AppError("SONG_SLUG_ALREADY_EXISTS");
      }
      throw error;
    });
}

export async function editSong(ctx: RequestContext, id: string, input: UpdateAdminSong) {
  requireAdmin(ctx);
  const { lrcText, slug, guideWrite, ...fields } = input;
  const row = {
    ...fields,
    ...(lrcText?.trim() ? { lyrics: parseSongLyrics(lrcText) } : {}),
    updatedAt: new Date().toISOString(),
  };

  try {
    return await getDatabase().transaction(async (tx) => {
      const existing = await lockSongForGuideWrite(tx, id);
      if (!existing) throw new AppError("SONG_NOT_FOUND");
      const next = await writeLegacyGuide(tx, existing, ctx.user.id, row, guideWrite);
      const [updated] = await updateSongWithSlugPolicy(tx, id, slug, row);
      if (!updated) throw new AppError("SONG_SLUG_IMMUTABLE");
      return { ...updated, ...(next ? { guideWrite: next } : {}) };
    });
  } catch (error) {
    if (error instanceof SongSlugConflictError) {
      throw new AppError("SONG_SLUG_ALREADY_EXISTS");
    }
    throw error;
  }
}

export async function saveSongLyrics(ctx: RequestContext, id: string, input: SaveAdminSongLyrics) {
  requireAdmin(ctx);
  const { guideWrite, ...changes } = input;
  return getDatabase().transaction(async (tx) => {
    const existing = await lockSongForGuideWrite(tx, id);
    if (!existing) throw new AppError("SONG_NOT_FOUND");
    const next = await writeLegacyGuide(tx, existing, ctx.user.id, changes, guideWrite);
    const [song] = await updateSong(tx, id, { ...changes, updatedAt: new Date().toISOString() });
    if (!song) throw new AppError("SONG_NOT_FOUND");
    return { ...song, ...(next ? { guideWrite: next } : {}) };
  });
}

export async function deleteSong(ctx: RequestContext, id: string) {
  requireAdmin(ctx);
  try {
    const [song] = await removeSong(getDatabase(), id);
    if (!song) throw new AppError("SONG_NOT_FOUND");
  } catch (error) {
    if (error instanceof CheerGuideReferenceError) throw new AppError("CONTENT_HAS_CHEER_GUIDE");
    throw error;
  }
}
