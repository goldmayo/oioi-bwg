import { eq } from "drizzle-orm";

import type { DbExecutor } from "../db";
import { type InsertSongRow, song } from "../db/schema";

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

export function insertSong(executor: DbExecutor, data: InsertSongRow) {
  return executor.insert(song).values(data);
}

export function updateSong(executor: DbExecutor, id: number, data: Partial<InsertSongRow>) {
  return executor.update(song).set(data).where(eq(song.id, id));
}

export function removeSong(executor: DbExecutor, id: number) {
  return executor.delete(song).where(eq(song.id, id));
}
