import "server-only";

import { eq } from "drizzle-orm";

import type { DbExecutor } from "../db";
import { isPostgresForeignKeyViolation, isPostgresUniqueViolation } from "../db/postgres-error";
import { album, type InsertAlbumRow } from "../db/schema";

import { publicGuideSummarySelection } from "./cheer-guide-repository";
import { AlbumSlugConflictError, CheerGuideReferenceError } from "./repository-error";

export function findVisibleAlbumsWithSongs(executor: DbExecutor) {
  return executor.query.album.findMany({
    where: (table, { eq: equals }) => equals(table.isVisible, true),
    with: {
      songs: {
        with: { cheerGuides: publicGuideSummarySelection },
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
        with: { cheerGuides: publicGuideSummarySelection },
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

export async function insertAlbum(executor: DbExecutor, data: InsertAlbumRow) {
  try {
    return await executor.insert(album).values(data).returning();
  } catch (error) {
    if (isPostgresUniqueViolation(error, "album_slug_key")) {
      throw new AlbumSlugConflictError();
    }
    throw error;
  }
}

export async function updateAlbum(executor: DbExecutor, id: string, data: Partial<InsertAlbumRow>) {
  try {
    return await executor.update(album).set(data).where(eq(album.id, id)).returning();
  } catch (error) {
    if (isPostgresUniqueViolation(error, "album_slug_key")) {
      throw new AlbumSlugConflictError();
    }
    throw error;
  }
}

export async function removeAlbum(executor: DbExecutor, id: string) {
  try {
    return await executor.delete(album).where(eq(album.id, id)).returning({ id: album.id });
  } catch (error) {
    if (isPostgresForeignKeyViolation(error, "cheer_guide_song_id_fkey")) {
      throw new CheerGuideReferenceError();
    }
    throw error;
  }
}
