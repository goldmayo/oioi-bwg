import { and, eq, isNull, or } from "drizzle-orm";

import type { DbExecutor } from "../db";
import { isPostgresUniqueViolation } from "../db/postgres-error";
import { type InsertSongRow, song } from "../db/schema";

import { SongSlugConflictError } from "./repository-error";

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

export function findSongSlugById(executor: DbExecutor, id: number) {
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
      slug: true,
      albumId: true,
      order: true,
      updatedAt: true,
      hasOfficialCheer: true,
      isTitle: true,
      isVisible: true,
    },
    orderBy: (table, { asc }) => [asc(table.order)],
  });
}

export function findSongsWithAlbum(executor: DbExecutor) {
  return executor.query.song.findMany({
    columns: {
      id: true,
      title: true,
      slug: true,
      albumId: true,
      order: true,
      youtubeId: true,
      updatedAt: true,
      hasOfficialCheer: true,
      isTitle: true,
      isVisible: true,
    },
    with: {
      album: {
        columns: { name: true },
      },
    },
    orderBy: (table, { asc }) => [asc(table.albumId), asc(table.order)],
  });
}

export async function insertSong(executor: DbExecutor, data: InsertSongRow) {
  try {
    return await executor.insert(song).values(data).returning({ id: song.id });
  } catch (error) {
    if (isPostgresUniqueViolation(error, "Song_slug_key")) {
      throw new SongSlugConflictError();
    }
    throw error;
  }
}

export function updateSong(executor: DbExecutor, id: number, data: SongUpdateRow) {
  return executor.update(song).set(data).where(eq(song.id, id)).returning({ id: song.id });
}

export async function updateSongWithSlugPolicy(
  executor: DbExecutor,
  id: number,
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
    if (isPostgresUniqueViolation(error, "Song_slug_key")) {
      throw new SongSlugConflictError();
    }
    throw error;
  }
}

export function removeSong(executor: DbExecutor, id: number) {
  return executor.delete(song).where(eq(song.id, id)).returning({ id: song.id });
}
