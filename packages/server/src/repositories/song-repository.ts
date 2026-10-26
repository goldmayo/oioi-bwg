import "server-only";

import { and, asc, eq, isNull, or } from "drizzle-orm";

import type { DbExecutor } from "../db";
import { isPostgresForeignKeyViolation, isPostgresUniqueViolation } from "../db/postgres-error";
import { album, type InsertSongRow, song } from "../db/schema";

import { SongSlugConflictError, CheerGuideReferenceError } from "./repository-error";

type SongUpdateRow = Partial<Omit<InsertSongRow, "slug">>;

export function findSongBySlug(executor: DbExecutor, slug: string) {
  return executor.query.song.findFirst({
    where: (table, { and, eq: equals }) =>
      and(equals(table.slug, slug), equals(table.isVisible, true)),
    with: {
      album: {
        with: {
          songs: true,
        },
      },
    },
  });
}

export function findAdminSongBySlug(executor: DbExecutor, slug: string) {
  return executor.query.song.findFirst({
    where: (table, { eq: equals }) => equals(table.slug, slug),
    columns: {
      id: true,
      title: true,
      youtubeId: true,
      lyrics: true,
    },
  });
}

export function findSongSlugById(executor: DbExecutor, id: string) {
  return executor.query.song.findFirst({
    where: (table, { eq: equals }) => equals(table.id, id),
    columns: { id: true, slug: true },
  });
}

export function findVisibleSongs(executor: DbExecutor) {
  return executor.query.song.findMany({
    where: (table, { eq: equals }) => equals(table.isVisible, true),
    columns: {
      id: true,
      title: true,
      youtubeId: true,
      slug: true,
      albumId: true,
      order: true,
      updatedAt: true,
      hasOfficialCheer: true,
      isTitle: true,
      isVisible: true,
    },
    with: { album: { columns: { isVisible: true } } },
    orderBy: (table, { asc }) => [asc(table.order)],
  });
}

export function findSongsWithAlbum(executor: DbExecutor) {
  return executor
    .select({
      id: song.id,
      title: song.title,
      slug: song.slug,
      albumId: song.albumId,
      order: song.order,
      youtubeId: song.youtubeId,
      updatedAt: song.updatedAt,
      hasOfficialCheer: song.hasOfficialCheer,
      isTitle: song.isTitle,
      isVisible: song.isVisible,
      album: { name: album.name },
    })
    .from(song)
    .innerJoin(album, eq(album.id, song.albumId))
    .orderBy(asc(album.releaseDate), asc(album.slug), asc(song.order), asc(song.slug));
}

export async function insertSong(executor: DbExecutor, data: InsertSongRow) {
  try {
    return await executor.insert(song).values(data).returning({ id: song.id });
  } catch (error) {
    if (isPostgresUniqueViolation(error, "song_slug_key")) {
      throw new SongSlugConflictError();
    }
    throw error;
  }
}

export function updateSong(executor: DbExecutor, id: string, data: SongUpdateRow) {
  return executor.update(song).set(data).where(eq(song.id, id)).returning({ id: song.id });
}

export async function updateSongWithSlugPolicy(
  executor: DbExecutor,
  id: string,
  slug: string | null,
  data: SongUpdateRow,
) {
  const slugCanBeSet =
    slug === null ? isNull(song.slug) : or(isNull(song.slug), eq(song.slug, slug));

  try {
    return await executor
      .update(song)
      .set({ ...data, slug })
      .where(and(eq(song.id, id), slugCanBeSet))
      .returning({ id: song.id });
  } catch (error) {
    if (isPostgresUniqueViolation(error, "song_slug_key")) {
      throw new SongSlugConflictError();
    }
    throw error;
  }
}

export async function removeSong(executor: DbExecutor, id: string) {
  try {
    return await executor.delete(song).where(eq(song.id, id)).returning({ id: song.id });
  } catch (error) {
    if (isPostgresForeignKeyViolation(error, "cheer_guide_song_id_fkey")) {
      throw new CheerGuideReferenceError();
    }
    throw error;
  }
}
