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
  getSongWaveform,
  importSongWaveform,
  getWaveformJob,
  getRunnerWaveformJob,
  requestWaveformJob as requestApprovedWaveformJob,
  recordWaveformEnqueued,
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
const requestWaveformJob = (context: ReturnType<typeof ctx>, songId: string) =>
  requestApprovedWaveformJob(context, songId, [videoId]);
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
  await db.insert(schema.album).values({
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
async function start(id: string) {
  const current = await getRunnerWaveformJob(id);
  const ack = await startWaveformJob({
    jobId: id,
    songId: current.songId,
    videoId: current.videoId,
    expectedAttemptId: current.attemptId,
  });
  expect(ack.started).toBe(true);
  return ack.attemptId!;
}
test("동시·중복 요청은 활성 Job 하나를 공유하며 요청자별 알림과 기기 발송을 한 번 저장한다", async () => {
  const track = await song();
  const requests = await Promise.all(
    Array.from({ length: 8 }, (_, i) => requestWaveformJob(ctx(accounts[i % 2]), track.id)),
  );
  const id = requests[0]!.job.id;
  expect(new Set(requests.map((r) => r.job.id)).size).toBe(1);
  expect(requests.filter((r) => r.created)).toHaveLength(1);
  const attemptId = await start(id);
  expect(attemptId).toBeTruthy();
  expect(await getRunnerWaveformJob(id)).toEqual({
    id,
    songId: track.id,
    videoId,
    status: "RUNNING",
    attemptId,
    enqueuedAt: null,
  });
  const input = { jobId: id, attemptId: attemptId!, status: "SUCCEEDED" as const, result };
  const completions = await Promise.all([completeWaveformJob(input), completeWaveformJob(input)]);
  expect(completions.filter((r) => r.applied)).toHaveLength(1);
  expect(completions).toEqual(
    expect.arrayContaining([
      { jobId: id, status: "SUCCEEDED", attemptId, applied: true },
      { jobId: id, status: "SUCCEEDED", attemptId, applied: false },
    ]),
  );
  expect(
    await recordWaveformEnqueued({
      jobId: id,
      songId: track.id,
      videoId,
      enqueuedAt: "2026-10-28T00:00:00Z",
    }),
  ).toMatchObject({ status: "SUCCEEDED", attemptId });
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
  const old = await start(job.id);
  const current = await start(job.id);
  expect(
    await completeWaveformJob({ jobId: job.id, attemptId: old!, status: "SUCCEEDED", result }),
  ).toEqual({ jobId: job.id, status: "RUNNING", attemptId: current, applied: false });
  expect(await events(job.id)).toHaveLength(0);
  await completeWaveformJob({ jobId: job.id, attemptId: current!, status: "SUCCEEDED", result });
  const next = await requestWaveformJob(ctx(), track.id);
  const attemptId = await start(next.job.id);
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
  ).toEqual({ jobId: next.job.id, status: "FAILED", attemptId, applied: false });
});
test("참조 영상이 바뀐 성공 결과는 저장하지 않고 최종 실패로 알린다", async () => {
  const track = await song();
  const { job } = await requestWaveformJob(ctx(), track.id);
  const attemptId = await start(job.id);
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
  const attemptId = await start(job.id);
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

test("전달 성공의 첫 확인은 중복·지연 기록에도 보존하고 terminal을 역전하지 않는다", async () => {
  const track = await song();
  const { job } = await requestWaveformJob(ctx(), track.id);
  const input = { jobId: job.id, songId: track.id, videoId, enqueuedAt: "2026-10-28T00:00:00Z" };
  await recordWaveformEnqueued(input);
  const ack = await startWaveformJob({ ...input, expectedAttemptId: null });
  const copies = await Promise.all(
    Array.from({ length: 4 }, () =>
      recordWaveformEnqueued({ ...input, enqueuedAt: "2026-10-28T00:00:01Z" }),
    ),
  );
  expect(
    copies.every(
      (r) =>
        r.enqueuedAt === "2026-10-28T00:00:00.000Z" &&
        r.attemptId === ack.attemptId &&
        r.status === "RUNNING",
    ),
  ).toBe(true);
  await completeWaveformJob({
    jobId: job.id,
    attemptId: ack.attemptId,
    status: "FAILED",
    errorCode: "DLQ",
  });
  expect(await recordWaveformEnqueued(input)).toMatchObject({
    status: "FAILED",
    attemptId: ack.attemptId,
  });
  expect(await startWaveformJob({ ...input, expectedAttemptId: ack.attemptId })).toMatchObject({
    status: "FAILED",
    started: false,
  });
  expect(await events(job.id)).toHaveLength(1);
});
test("source 승인 목록은 현재 Song 잠금 안에서 검사하며 거절에는 Job이 생기지 않는다", async () => {
  const track = await song();
  for (const approved of [[], ["lmnopqrstuv"]])
    await expect(requestApprovedWaveformJob(ctx(), track.id, approved)).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  expect(
    await db.select().from(schema.waveformJob).where(eq(schema.waveformJob.songId, track.id)),
  ).toHaveLength(0);
  const { job } = await requestWaveformJob(ctx(), track.id);
  await db
    .update(schema.song)
    .set({ youtubeId: "lmnopqrstuv" })
    .where(eq(schema.song.id, track.id));
  await expect(requestWaveformJob(ctx(), track.id)).rejects.toMatchObject({ code: "FORBIDDEN" });
  expect(await getRunnerWaveformJob(job.id)).toMatchObject({ status: "QUEUED" });
});
test("확정 미전달의 동시 terminal은 한 번만 반영하고 요청자 알림을 원자적으로 만든다", async () => {
  const track = await song();
  const { job } = await requestWaveformJob(ctx(), track.id);
  await requestWaveformJob(ctx(accounts[1]), track.id);
  const input = {
    jobId: job.id,
    attemptId: null,
    status: "FAILED" as const,
    errorCode: "ENQUEUE_FAILED" as const,
  };
  const copies = await Promise.all(Array.from({ length: 4 }, () => completeWaveformJob(input)));
  expect(copies.filter((r) => r.applied)).toHaveLength(1);
  expect(await events(job.id)).toHaveLength(2);
  const ids = (await events(job.id)).map((r) => r.id);
  expect(
    await db
      .select()
      .from(schema.notificationDelivery)
      .where(inArray(schema.notificationDelivery.notificationId, ids)),
  ).toHaveLength(2);
});
test("확정 실패의 늦은 반영은 이미 전달 확인되거나 실행된 Job을 뒤집지 않는다", async () => {
  for (const state of ["enqueued", "running"] as const) {
    const track = await song();
    const { job } = await requestWaveformJob(ctx(), track.id);
    if (state === "enqueued")
      await recordWaveformEnqueued({
        jobId: job.id,
        songId: track.id,
        videoId,
        enqueuedAt: "2026-10-29T00:00:00Z",
      });
    else await start(job.id);
    expect(
      await completeWaveformJob({
        jobId: job.id,
        attemptId: null,
        status: "FAILED",
        errorCode: "ENQUEUE_FAILED",
      }),
    ).toMatchObject({ applied: false, status: state === "enqueued" ? "QUEUED" : "RUNNING" });
    expect(await events(job.id)).toHaveLength(0);
  }
});
test("동시 start와 응답 유실 후 같은 요청은 attempt 하나만 만들며 늦은 요청은 새 실행을 덮지 않는다", async () => {
  const track = await song();
  const { job } = await requestWaveformJob(ctx(), track.id);
  const input = { jobId: job.id, songId: track.id, videoId, expectedAttemptId: null };
  const starts = await Promise.all(Array.from({ length: 4 }, () => startWaveformJob(input)));
  expect(starts.filter((r) => r.started)).toHaveLength(1);
  expect(new Set(starts.map((r) => r.attemptId)).size).toBe(1);
  const old = starts[0]!.attemptId;
  expect(await startWaveformJob(input)).toMatchObject({
    attemptId: old,
    started: false,
    enqueuedAt: null,
  });
  const next = await startWaveformJob({ ...input, expectedAttemptId: old });
  expect(next.started).toBe(true);
  expect(next.attemptId).not.toBe(old);
  expect(await startWaveformJob(input)).toMatchObject({
    attemptId: next.attemptId,
    started: false,
  });
  expect(
    await completeWaveformJob({ jobId: job.id, attemptId: old!, status: "SUCCEEDED", result }),
  ).toMatchObject({ applied: false, attemptId: next.attemptId });
  expect(await saved(track.id)).toHaveLength(0);
  expect(await events(job.id)).toHaveLength(0);
});
test("변조된 식별자와 변경된 source는 시작하지 않으며 삭제된 Job은 명확한 404다", async () => {
  const track = await song();
  const { job } = await requestWaveformJob(ctx(), track.id);
  const input = {
    jobId: job.id,
    songId: track.id,
    videoId,
    expectedAttemptId: null,
    enqueuedAt: "2026-10-28T00:00:00Z",
  };
  for (const wrong of [
    { ...input, videoId: "lmnopqrstuv" },
    { ...input, songId: createEntityId() },
  ]) {
    await expect(recordWaveformEnqueued(wrong)).rejects.toMatchObject({
      code: "WAVEFORM_SOURCE_INVALID",
    });
    await expect(startWaveformJob(wrong)).rejects.toMatchObject({
      code: "WAVEFORM_SOURCE_INVALID",
    });
  }
  expect(await getRunnerWaveformJob(job.id)).toMatchObject({
    status: "QUEUED",
    attemptId: null,
    enqueuedAt: null,
  });
  await db
    .update(schema.song)
    .set({ youtubeId: "lmnopqrstuv" })
    .where(eq(schema.song.id, track.id));
  await expect(startWaveformJob(input)).rejects.toMatchObject({ code: "WAVEFORM_SOURCE_INVALID" });
  await db.delete(schema.song).where(eq(schema.song.id, track.id));
  await expect(recordWaveformEnqueued(input)).rejects.toMatchObject({
    code: "WAVEFORM_JOB_NOT_FOUND",
  });
  await expect(startWaveformJob(input)).rejects.toMatchObject({ code: "WAVEFORM_JOB_NOT_FOUND" });
});

test("현재 영상의 파형 JSON만 읽고 영상 변경·파형 부재·삭제를 구분한다", async () => {
  const track = await song();
  expect(await getSongWaveform(ctx(), track.id)).toBeNull();
  const { job } = await requestWaveformJob(ctx(), track.id);
  const attemptId = await start(job.id);
  await completeWaveformJob({ jobId: job.id, attemptId, status: "SUCCEEDED", result });
  expect(await getSongWaveform(ctx(), track.id)).toEqual(result);
  await db
    .update(schema.song)
    .set({ youtubeId: "lmnopqrstuv" })
    .where(eq(schema.song.id, track.id));
  expect(await getSongWaveform(ctx(), track.id)).toBeNull();
  await expect(getSongWaveform(ctx(accounts[0], "USER"), track.id)).rejects.toMatchObject({
    code: "FORBIDDEN",
  });
  await db.delete(schema.song).where(eq(schema.song.id, track.id));
  await expect(getSongWaveform(ctx(), track.id)).rejects.toMatchObject({ code: "SONG_NOT_FOUND" });
});

test("동시 JSON 업로드는 Job·파형·알림을 한 번 저장하고 기존 RUNNING attempt를 무효화한다", async () => {
  const track = await song();
  const { job } = await requestWaveformJob(ctx(accounts[1]), track.id);
  const oldAttempt = await start(job.id);
  const copies = await Promise.all(
    Array.from({ length: 4 }, () => importSongWaveform(ctx(), track.id, result)),
  );
  expect(new Set(copies.map((j) => j.id))).toEqual(new Set([job.id]));
  expect(copies.every((j) => j.status === "SUCCEEDED")).toBe(true);
  expect(await getSongWaveform(ctx(), track.id)).toEqual(result);
  expect(await events(job.id)).toHaveLength(2);
  expect(await saved(track.id)).toHaveLength(1);
  expect(
    await completeWaveformJob({
      jobId: job.id,
      attemptId: oldAttempt,
      status: "FAILED",
      errorCode: "DLQ",
    }),
  ).toMatchObject({ applied: false, status: "SUCCEEDED" });
  expect((await getRunnerWaveformJob(job.id)).attemptId).not.toBe(oldAttempt);
  const [unchanged] = await db.select().from(schema.song).where(eq(schema.song.id, track.id));
  expect(unchanged).toEqual(track);
});
test("JSON 업로드는 ADMIN과 현재 source를 검사하고 잘못된 입력·알림 실패는 기존 JSON을 보존한다", async () => {
  const track = await song();
  await expect(
    importSongWaveform(ctx(accounts[0], "USER"), track.id, result),
  ).rejects.toMatchObject({ code: "FORBIDDEN" });
  const first = await importSongWaveform(ctx(), track.id, result);
  const changed = { ...result, peaks: { ...result.peaks, data: [-5, 5, -2, 2] } };
  const spy = vi
    .spyOn(notifications, "recordWaveformNotification")
    .mockRejectedValueOnce(new Error("import rollback"));
  try {
    await expect(importSongWaveform(ctx(), track.id, changed)).rejects.toThrow("import rollback");
  } finally {
    spy.mockRestore();
  }
  expect(await getSongWaveform(ctx(), track.id)).toEqual(result);
  expect(await events(first.id)).toHaveLength(1);
  expect(
    await db.select().from(schema.waveformJob).where(eq(schema.waveformJob.songId, track.id)),
  ).toHaveLength(1);
  await expect(
    importSongWaveform(ctx(), track.id, {
      ...result,
      source: { type: "youtube", id: "lmnopqrstuv" },
    }),
  ).rejects.toMatchObject({ code: "WAVEFORM_SOURCE_INVALID" });
  const second = await importSongWaveform(ctx(), track.id, changed);
  expect(second.id).not.toBe(first.id);
  expect(await getSongWaveform(ctx(), track.id)).toEqual(changed);
});
