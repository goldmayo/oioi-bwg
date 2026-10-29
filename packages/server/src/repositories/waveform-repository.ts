import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DbExecutor } from "../db";
import { song, waveform, waveformJob, waveformJobRequester } from "../db/schema";
export async function lockWaveformSong(db: DbExecutor, id: string) {
  await db.execute(sql`set local lock_timeout = '5s'`);
  const [row] = await db.select().from(song).where(eq(song.id, id)).for("update");
  return row;
}
export async function findWaveformJob(db: DbExecutor, id: string) {
  const [row] = await db
    .select({ job: waveformJob, slug: song.slug })
    .from(waveformJob)
    .innerJoin(song, eq(song.id, waveformJob.songId))
    .where(eq(waveformJob.id, id));
  return row;
}
export async function lockWaveformJob(db: DbExecutor, id: string) {
  const [row] = await db.select().from(waveformJob).where(eq(waveformJob.id, id)).for("update");
  return row;
}
export async function findActiveWaveformJob(db: DbExecutor, songId: string, videoId: string) {
  const [row] = await db
    .select()
    .from(waveformJob)
    .where(
      and(
        eq(waveformJob.songId, songId),
        eq(waveformJob.videoId, videoId),
        inArray(waveformJob.status, ["QUEUED", "RUNNING"]),
      ),
    );
  return row;
}
export async function insertWaveformJob(db: DbExecutor, songId: string, videoId: string) {
  const [row] = await db.insert(waveformJob).values({ songId, videoId }).returning();
  return row!;
}
export async function insertWaveformRequester(db: DbExecutor, jobId: string, accountId: string) {
  await db.insert(waveformJobRequester).values({ jobId, accountId }).onConflictDoNothing();
}
export function findWaveformRequesters(db: DbExecutor, jobId: string) {
  return db.select().from(waveformJobRequester).where(eq(waveformJobRequester.jobId, jobId));
}
export async function updateWaveformJob(
  db: DbExecutor,
  id: string,
  values: Partial<Omit<typeof waveformJob.$inferInsert, "id" | "songId" | "videoId">>,
) {
  const [row] = await db.update(waveformJob).set(values).where(eq(waveformJob.id, id)).returning();
  return row!;
}
export async function storeWaveform(
  db: DbExecutor,
  values: Pick<typeof waveform.$inferInsert, "songId" | "videoId" | "data">,
) {
  await db
    .insert(waveform)
    .values(values)
    .onConflictDoUpdate({
      target: waveform.songId,
      set: { videoId: values.videoId, data: values.data, generatedAt: sql`now()` },
    });
}

/** 현재 참조 영상과 같은 파형만 읽으며 결과가 없어도 곡 존재 여부를 구분한다. */
export async function findSongWaveform(db: DbExecutor, id: string) {
  const [row] = await db
    .select({ videoId: song.youtubeId, data: waveform.data })
    .from(song)
    .leftJoin(waveform, and(eq(waveform.songId, song.id), eq(waveform.videoId, song.youtubeId)))
    .where(eq(song.id, id));
  return row;
}
