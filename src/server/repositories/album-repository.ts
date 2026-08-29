import { eq } from "drizzle-orm";

import type { DbExecutor } from "../db";
import { album, type InsertAlbumRow } from "../db/schema";

export function findVisibleAlbumsWithSongs(executor: DbExecutor) {
  return executor.query.album.findMany({
    where: (table, { eq: equals }) => equals(table.isVisible, true),
    with: {
      songs: {
        where: (table, { eq: equals }) => equals(table.isVisible, true),
        orderBy: (table, { asc }) => [asc(table.order)],
        columns: {
          id: true,
          slug: true,
          title: true,
          hasOfficialCheer: true,
          youtubeId: true,
          isTitle: true,
        },
      },
    },
    orderBy: (table, { desc }) => [desc(table.releaseDate)],
  });
}

export function findAlbumBySlug(executor: DbExecutor, slug: string) {
  return executor.query.album.findFirst({
    where: (table, { and, eq: equals }) =>
      and(equals(table.slug, slug), equals(table.isVisible, true)),
    with: {
      songs: {
        where: (table, { eq: equals }) => equals(table.isVisible, true),
        orderBy: (table, { asc }) => [asc(table.order)],
        columns: {
          id: true,
          slug: true,
          title: true,
          hasOfficialCheer: true,
          youtubeId: true,
          isTitle: true,
        },
      },
    },
  });
}

export function findAllAlbums(executor: DbExecutor) {
  return executor.query.album.findMany({
    orderBy: (table, { asc }) => [asc(table.releaseDate)],
  });
}

export function insertAlbum(executor: DbExecutor, data: InsertAlbumRow) {
  return executor.insert(album).values(data);
}

export function updateAlbum(executor: DbExecutor, id: number, data: Partial<InsertAlbumRow>) {
  return executor.update(album).set(data).where(eq(album.id, id));
}

export function removeAlbum(executor: DbExecutor, id: number) {
  return executor.delete(album).where(eq(album.id, id));
}
