import "server-only";

import { and, eq, sql } from "drizzle-orm";

import type { DbExecutor } from "../db";
import { cheerGuide, cheerGuidePublication, cheerGuideSnapshot, song } from "../db/schema";

export async function lockSongForGuideWrite(executor: DbExecutor, id: string) {
  await executor.execute(sql`set local lock_timeout = '5s'`);
  await executor.execute(sql`set local statement_timeout = '30s'`);
  const [row] = await executor.select().from(song).where(eq(song.id, id)).for("update");
  return row;
}

export async function lockLegacyGuide(executor: DbExecutor, songId: string) {
  const [row] = await executor
    .select()
    .from(cheerGuide)
    .where(and(eq(cheerGuide.songId, songId), eq(cheerGuide.legacyWriteTarget, true)))
    .for("update");
  return row;
}

export async function findGuidePublication(
  executor: DbExecutor,
  guideId: string,
  publicationId: string,
) {
  const [row] = await executor
    .select({
      action: cheerGuidePublication.action,
      referenceYoutubeId: cheerGuideSnapshot.referenceYoutubeId,
      sourceType: cheerGuideSnapshot.sourceType,
      sourceUrl: cheerGuideSnapshot.sourceUrl,
      guideVideoUrl: cheerGuideSnapshot.guideVideoUrl,
      description: cheerGuideSnapshot.description,
    })
    .from(cheerGuidePublication)
    .innerJoin(cheerGuideSnapshot, eq(cheerGuideSnapshot.id, cheerGuidePublication.snapshotId))
    .where(
      and(
        eq(cheerGuidePublication.id, publicationId),
        eq(cheerGuidePublication.cheerGuideId, guideId),
      ),
    );
  return row;
}

export async function claimGuideVersion(executor: DbExecutor, id: string, expected: number) {
  const [row] = await executor
    .update(cheerGuide)
    .set({
      lockVersion: sql`${cheerGuide.lockVersion} + 1`,
      updatedAt: sql`now()`,
    })
    .where(and(eq(cheerGuide.id, id), eq(cheerGuide.lockVersion, expected)))
    .returning({ lockVersion: cheerGuide.lockVersion });
  return row;
}

export async function insertNextGuideSnapshot(
  executor: DbExecutor,
  data: Omit<typeof cheerGuideSnapshot.$inferInsert, "id" | "versionNo" | "createdAt">,
) {
  const [row] = await executor
    .insert(cheerGuideSnapshot)
    .values({
      ...data,
      versionNo: sql`(select coalesce(max(${cheerGuideSnapshot.versionNo}), 0) + 1 from ${cheerGuideSnapshot} where ${cheerGuideSnapshot.cheerGuideId} = ${data.cheerGuideId})`,
    })
    .returning({ id: cheerGuideSnapshot.id });
  if (!row) throw new Error("Guide snapshot was not created");
  return row;
}

export async function insertNextGuidePublication(
  executor: DbExecutor,
  data: Omit<typeof cheerGuidePublication.$inferInsert, "id" | "publicationNo" | "createdAt">,
) {
  const [row] = await executor
    .insert(cheerGuidePublication)
    .values({
      ...data,
      publicationNo: sql`(select coalesce(max(${cheerGuidePublication.publicationNo}), 0) + 1 from ${cheerGuidePublication} where ${cheerGuidePublication.cheerGuideId} = ${data.cheerGuideId})`,
    })
    .returning({ id: cheerGuidePublication.id });
  if (!row) throw new Error("Guide publication was not created");
  return row;
}

export function setGuidePublication(executor: DbExecutor, id: string, publicationId: string) {
  return executor
    .update(cheerGuide)
    .set({ currentPublicationId: publicationId })
    .where(eq(cheerGuide.id, id));
}

export const publicGuideSummarySelection = {
  columns: { id: true, mode: true },
  with: {
    publications: { columns: { id: true }, limit: 1 },
    currentPublication: {
      columns: { action: true },
      with: { snapshot: { columns: { sourceType: true, referenceYoutubeId: true } } },
    },
  },
} as const;
export const publicGuideDetailSelection = {
  ...publicGuideSummarySelection,
  with: {
    ...publicGuideSummarySelection.with,
    currentPublication: {
      columns: { action: true },
      with: {
        snapshot: {
          columns: {
            sourceType: true,
            referenceYoutubeId: true,
            lyrics: true,
            sourceUrl: true,
            guideVideoUrl: true,
            description: true,
          },
        },
      },
    },
  },
} as const;
