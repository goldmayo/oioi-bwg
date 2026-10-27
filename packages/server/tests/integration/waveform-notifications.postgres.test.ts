import { drizzle } from "drizzle-orm/postgres-js";
import { eq, inArray } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, beforeAll, expect, test, vi } from "vitest";
import { buildAbility } from "../../src/auth/ability";
import { createEntityId } from "../../src/db/entity-id";
import * as schema from "../../src/db/schema";
import * as notifications from "../../src/services/notification-service";
import {
  completeWaveformJob,
  getWaveformJob,
  requestWaveformJob,
  startWaveformJob,
} from "../../src/services/waveform-service";
vi.mock("../../src/db", () => ({ getDatabase: () => db }));
const url = new URL(process.env.DATABASE_URL ?? "http://invalid");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  !/^\/oioi_m7_test_[a-z0-9_]+$/.test(url.pathname)
)
  throw new Error("Isolated local waveform database required");
const client = postgres(url.toString(), { max: 6 });
const db = drizzle(client, { schema });
const accounts = [createEntityId(), createEntityId()];
const albumId = createEntityId();
const ctx = (id = accounts[0]!, role: "ADMIN" | "USER" = "ADMIN") => ({
  user: { id },
  ability: buildAbility({ accountId: id, role }),
});
const videoId = "abcdefghijk";
const result = {
  durationMs: 40,
  bucketSizeMs: 20,
  peaks: {
    version: 1 as const,
    sample_rate: 24000,
    samples_per_pixel: 480,
    bits: 8 as const,
    length: 2,
    data: [-20, 20, -10, 10],
  },
  source: { type: "youtube" as const, id: videoId },
  generationVersion: 1 as const,
};
beforeAll(async () => {
  await db
    .insert(schema.account)
    .values(accounts.map((id) => ({ id, role: "ADMIN" as const, status: "ACTIVE" as const })));
  await db
    .insert(schema.album)
    .values({
      id: albumId,
      name: "waveform fixture",
      slug: `waveform-${albumId}`,
      imgUrl: "https://example.test/album.png",
      color: "#000000",
    });
  await db.insert(schema.pushInstallation).values(
    accounts.map((accountId) => ({
      fid: `c${createEntityId().replaceAll("-", "")}`,
      accountId,
      mfaVersion: 1,
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
    })),
  );
});
afterAll(async () => {
  const ids = (
    await db
      .select({ id: schema.notification.id })
      .from(schema.notification)
      .where(inArray(schema.notification.recipientAccountId, accounts))
  ).map((r) => r.id);
  if (ids.length)
    await db
      .delete(schema.notificationDelivery)
      .where(inArray(schema.notificationDelivery.notificationId, ids));
  await db
    .delete(schema.notification)
    .where(inArray(schema.notification.recipientAccountId, accounts));
  await db
    .delete(schema.pushInstallation)
    .where(inArray(schema.pushInstallation.accountId, accounts));
  await db.delete(schema.song).where(eq(schema.song.albumId, albumId));
  await db.delete(schema.album).where(eq(schema.album.id, albumId));
  await db.delete(schema.account).where(inArray(schema.account.id, accounts));
  await client.end();
});
async function song() {
  const [row] = await db
    .insert(schema.song)
    .values({
      albumId,
      title: "waveform fixture",
      slug: `waveform-${createEntityId()}`,
      youtubeId: videoId,
    })
    .returning();
  return row!;
}
async function events(jobId: string) {
  return db.select().from(schema.notification).where(eq(schema.notification.resourceId, jobId));
}
async function saved(songId: string) {
  return db.select().from(schema.waveform).where(eq(schema.waveform.songId, songId));
}
test("동시·중복 요청은 활성 Job 하나를 공유하며 요청자별 알림과 기기 발송을 한 번 저장한다", async () => {
  const track = await song();
  const requests = await Promise.all(
    Array.from({ length: 8 }, (_, i) => requestWaveformJob(ctx(accounts[i % 2]), track.id)),
  );
  const id = requests[0]!.job.id;
  expect(new Set(requests.map((r) => r.job.id)).size).toBe(1);
  expect(requests.filter((r) => r.created)).toHaveLength(1);
  const attemptId = await startWaveformJob(id);
  expect(attemptId).toBeTruthy();
  const input = { jobId: id, attemptId: attemptId!, status: "SUCCEEDED" as const, result };
  const completions = await Promise.all([completeWaveformJob(input), completeWaveformJob(input)]);
  expect(completions.filter((r) => r.applied)).toHaveLength(1);
  const notices = await events(id);
  expect(notices).toHaveLength(2);
  expect(new Set(notices.map((r) => r.recipientAccountId))).toEqual(new Set(accounts));
  expect(notices.every((r) => r.readAt === null)).toBe(true);
  expect(
    await db
      .select()
      .from(schema.notificationDelivery)
      .where(
        inArray(
          schema.notificationDelivery.notificationId,
          notices.map((r) => r.id),
        ),
      ),
  ).toHaveLength(2);
  expect(await saved(track.id)).toHaveLength(1);
  expect(await getWaveformJob(ctx(), id)).toMatchObject({
    status: "SUCCEEDED",
    editorHref: `/admin/edit/${track.slug}`,
  });
  const next = await requestWaveformJob(ctx(), track.id);
  expect(next.created).toBe(true);
  expect(next.job.id).not.toBe(id);
});
test("이전 attempt·terminal 재전달은 무시하고 재생성 실패는 직전 정상 JSON을 보존한다", async () => {
  const track = await song();
  const { job } = await requestWaveformJob(ctx(), track.id);
  const old = await startWaveformJob(job.id);
  const current = await startWaveformJob(job.id);
  expect(
    await completeWaveformJob({ jobId: job.id, attemptId: old!, status: "SUCCEEDED", result }),
  ).toEqual({ applied: false });
  expect(await events(job.id)).toHaveLength(0);
  await completeWaveformJob({ jobId: job.id, attemptId: current!, status: "SUCCEEDED", result });
  const next = await requestWaveformJob(ctx(), track.id);
  const attemptId = await startWaveformJob(next.job.id);
  await completeWaveformJob({ jobId: next.job.id, attemptId, status: "FAILED", errorCode: "DLQ" });
  expect((await saved(track.id))[0]!.data).toEqual(result);
  expect(await events(next.job.id)).toMatchObject([{ type: "WAVEFORM_FAILED" }]);
  expect(
    await completeWaveformJob({
      jobId: next.job.id,
      attemptId: attemptId!,
      status: "SUCCEEDED",
      result,
    }),
  ).toEqual({ applied: false });
});
test("참조 영상이 바뀐 성공 결과는 저장하지 않고 최종 실패로 알린다", async () => {
  const track = await song();
  const { job } = await requestWaveformJob(ctx(), track.id);
  const attemptId = await startWaveformJob(job.id);
  await db
    .update(schema.song)
    .set({ youtubeId: "lmnopqrstuv" })
    .where(eq(schema.song.id, track.id));
  await completeWaveformJob({ jobId: job.id, attemptId: attemptId!, status: "SUCCEEDED", result });
  expect(await saved(track.id)).toHaveLength(0);
  expect(await getWaveformJob(ctx(), job.id)).toMatchObject({
    status: "FAILED",
    errorCode: "SOURCE_CHANGED",
  });
  expect(await events(job.id)).toMatchObject([{ type: "WAVEFORM_FAILED" }]);
});
test("알림 저장 실패는 JSON·terminal·모든 알림을 함께 rollback한다", async () => {
  const track = await song();
  const { job } = await requestWaveformJob(ctx(), track.id);
  const attemptId = await startWaveformJob(job.id);
  await requestWaveformJob(ctx(accounts[1]), track.id);
  const original = notifications.recordWaveformNotification;
  const spy = vi
    .spyOn(notifications, "recordWaveformNotification")
    .mockImplementationOnce(original)
    .mockRejectedValueOnce(new Error("injected notification failure"));
  try {
    await expect(
      completeWaveformJob({ jobId: job.id, attemptId: attemptId!, status: "SUCCEEDED", result }),
    ).rejects.toThrow("injected");
  } finally {
    spy.mockRestore();
  }
  expect(await saved(track.id)).toHaveLength(0);
  expect(await events(job.id)).toHaveLength(0);
  expect(await getWaveformJob(ctx(), job.id)).toMatchObject({ status: "RUNNING" });
  await completeWaveformJob({ jobId: job.id, attemptId: attemptId!, status: "SUCCEEDED", result });
  expect(await events(job.id)).toHaveLength(2);
});
test("생성·상태 조회는 관리자만 허용하고 enqueue 확정 실패도 요청자에게 알린다", async () => {
  const track = await song();
  await expect(requestWaveformJob(ctx(accounts[0], "USER"), track.id)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  const { job } = await requestWaveformJob(ctx(), track.id);
  await expect(getWaveformJob(ctx(accounts[0], "USER"), job.id)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await completeWaveformJob({
    jobId: job.id,
    attemptId: null,
    status: "FAILED",
    errorCode: "ENQUEUE_FAILED",
  });
  expect(await events(job.id)).toMatchObject([{ type: "WAVEFORM_FAILED" }]);
});
