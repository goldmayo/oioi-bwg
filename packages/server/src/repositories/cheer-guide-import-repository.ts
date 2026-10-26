import "server-only";

import { asc, eq } from "drizzle-orm";
import type { DbExecutor } from "../db";
import { cheerGuide, cheerGuidePublication, cheerGuideSnapshot, song } from "../db/schema";

export function findLegacyGuideCandidates(executor: DbExecutor) {
  return executor
    .select({
      id: song.id,
      title: song.title,
      slug: song.slug,
      lyrics: song.lyrics,
      youtubeId: song.youtubeId,
      hasOfficialCheer: song.hasOfficialCheer,
    })
    .from(song)
    .orderBy(asc(song.id));
}
export async function findGuideImportState(executor: DbExecutor, songId: string) {
  const guides = await executor
    .select()
    .from(cheerGuide)
    .where(eq(cheerGuide.songId, songId))
    .orderBy(asc(cheerGuide.id))
    .for("update");
  const histories = await Promise.all(
    guides.map(async (guide) => ({
      guide,
      snapshots: await executor
        .select()
        .from(cheerGuideSnapshot)
        .where(eq(cheerGuideSnapshot.cheerGuideId, guide.id)),
      publications: await executor
        .select()
        .from(cheerGuidePublication)
        .where(eq(cheerGuidePublication.cheerGuideId, guide.id)),
    })),
  );
  return histories;
}
export async function insertImportedGuide(
  executor: DbExecutor,
  input: {
    guide: typeof cheerGuide.$inferInsert & { id: string };
    snapshot: typeof cheerGuideSnapshot.$inferInsert & { id: string };
    publication: typeof cheerGuidePublication.$inferInsert & { id: string };
  },
) {
  await executor.insert(cheerGuide).values(input.guide);
  await executor.insert(cheerGuideSnapshot).values(input.snapshot);
  await executor.insert(cheerGuidePublication).values(input.publication);
  await executor
    .update(cheerGuide)
    .set({ currentPublicationId: input.publication.id })
    .where(eq(cheerGuide.id, input.guide.id));
}
