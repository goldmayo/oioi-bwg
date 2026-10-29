import "server-only";
import type {
  WaveformEnqueuedInput,
  WaveformJob,
  WaveformQueuePayload,
  WaveformStartInput,
  WaveformTerminal,
} from "@oioi-bwg/contracts/waveform";
import { requireUser, type RequestContext } from "../auth/request-context";
import { getDatabase, type DbExecutor } from "../db";
import { createEntityId } from "../db/entity-id";
import { AppError } from "../errors/app-error";
import {
  findActiveWaveformJob,
  findSongWaveform,
  findWaveformJob,
  findWaveformRequesters,
  insertWaveformJob,
  insertWaveformRequester,
  lockWaveformJob,
  lockWaveformSong,
  storeWaveform,
  updateWaveformJob,
} from "../repositories/waveform-repository";
import { recordWaveformNotification } from "./notification-service";
function admin(ctx: RequestContext) {
  requireUser(ctx);
  if (ctx.ability.cannot("manage", "all")) throw new AppError("FORBIDDEN");
  return ctx.user.id;
}
function project(row: NonNullable<Awaited<ReturnType<typeof findWaveformJob>>>): WaveformJob {
  const { job, slug } = row;
  return {
    id: job.id,
    songId: job.songId,
    videoId: job.videoId,
    status: job.status,
    errorCode: job.errorCode,
    createdAt: new Date(job.createdAt).toISOString(),
    finishedAt: job.finishedAt ? new Date(job.finishedAt).toISOString() : null,
    editorHref: slug ? `/admin/edit/${encodeURIComponent(slug)}` : null,
  };
}
export async function getWaveformJob(ctx: RequestContext, id: string) {
  admin(ctx);
  const row = await findWaveformJob(getDatabase(), id);
  if (!row) throw new AppError("WAVEFORM_JOB_NOT_FOUND");
  return project(row);
}
/** JSON 조회는 생성 권한/Queue와 독립이며 기존 가사와 Cue를 변경하지 않는다. */
export async function getSongWaveform(ctx: RequestContext, id: string) {
  admin(ctx);
  const row = await findSongWaveform(getDatabase(), id);
  if (!row) throw new AppError("SONG_NOT_FOUND");
  return row.data && row.data.source.id === row.videoId ? row.data : null;
}
/** 서비스 토큰을 검증한 Console 내부 adapter만 호출한다. */
export async function getRunnerWaveformJob(id: string) {
  const row = await findWaveformJob(getDatabase(), id);
  if (!row) throw new AppError("WAVEFORM_JOB_NOT_FOUND");
  return projectRunner(row.job);
}
function projectRunner(job: NonNullable<Awaited<ReturnType<typeof lockWaveformJob>>>) {
  return {
    id: job.id,
    songId: job.songId,
    videoId: job.videoId,
    status: job.status,
    attemptId: job.attemptId,
    enqueuedAt: job.enqueuedAt ? new Date(job.enqueuedAt).toISOString() : null,
  };
}
async function lockRunnerJob(tx: DbExecutor, input: WaveformQueuePayload) {
  const found = await findWaveformJob(tx, input.jobId);
  if (!found) throw new AppError("WAVEFORM_JOB_NOT_FOUND");
  const song = await lockWaveformSong(tx, found.job.songId);
  const job = await lockWaveformJob(tx, input.jobId);
  if (!song || !job) throw new AppError("WAVEFORM_JOB_NOT_FOUND");
  if (job.songId !== input.songId || job.videoId !== input.videoId)
    throw new AppError("WAVEFORM_SOURCE_INVALID");
  return { job, song };
}
/** PutMessages 성공을 확인한 Runner만 호출한다. 첫 확인을 보존하며 상태는 변경하지 않는다. */
export async function recordWaveformEnqueued(input: WaveformEnqueuedInput) {
  return getDatabase().transaction(async (tx) => {
    const { job } = await lockRunnerJob(tx, input);
    return projectRunner(
      job.enqueuedAt
        ? job
        : await updateWaveformJob(tx, job.id, {
            enqueuedAt: new Date(input.enqueuedAt).toISOString(),
          }),
    );
  });
}
/** 보호된 운영 설정의 승인 목록을 Song 잠금 안에서 검사한다. 사용자 입력으로 목록을 받지 않는다. */
export async function requestWaveformJob(
  ctx: RequestContext,
  songId: string,
  allowedVideoIds: readonly string[],
) {
  const accountId = admin(ctx);
  return getDatabase().transaction(async (tx) => {
    const song = await lockWaveformSong(tx, songId);
    if (!song) throw new AppError("SONG_NOT_FOUND");
    if (!song.youtubeId || !/^[A-Za-z0-9_-]{11}$/.test(song.youtubeId))
      throw new AppError("WAVEFORM_SOURCE_INVALID");
    if (!allowedVideoIds.includes(song.youtubeId)) throw new AppError("FORBIDDEN");
    const existing = await findActiveWaveformJob(tx, songId, song.youtubeId);
    const job = existing ?? (await insertWaveformJob(tx, songId, song.youtubeId));
    // Song → Job → requester 순서를 terminal 경로와 통일한다.
    await lockWaveformJob(tx, job.id);
    await insertWaveformRequester(tx, job.id, accountId);
    return { job: project({ job, slug: song.slug }), created: !existing };
  });
}
/** Runner가 visibility 소유권과 이전 container 정리를 확인한 뒤 호출할 내부 use case다. */
export async function startWaveformJob(input: WaveformStartInput) {
  return getDatabase().transaction(async (tx) => {
    const { job, song } = await lockRunnerJob(tx, input);
    if (
      job.status === "SUCCEEDED" ||
      job.status === "FAILED" ||
      job.attemptId !== input.expectedAttemptId
    )
      return { ...projectRunner(job), started: false };
    if (song.youtubeId !== job.videoId) throw new AppError("WAVEFORM_SOURCE_INVALID");
    const current = await updateWaveformJob(tx, job.id, {
      status: "RUNNING",
      attemptId: createEntityId(),
      startedAt: new Date().toISOString(),
    });
    return { ...projectRunner(current), started: true };
  });
}
/** 검증된 내부 결과만 받는다. 결과·terminal·요청자별 알림·기기 발송 대기를 함께 commit한다. */
export async function completeWaveformJob(input: WaveformTerminal) {
  const found = await findWaveformJob(getDatabase(), input.jobId);
  if (!found) throw new AppError("WAVEFORM_JOB_NOT_FOUND");
  return getDatabase().transaction(async (tx) => {
    const song = await lockWaveformSong(tx, found.job.songId);
    const job = await lockWaveformJob(tx, input.jobId);
    if (!song || !job) throw new AppError("WAVEFORM_JOB_NOT_FOUND");
    const ack = (applied: boolean) => ({
      jobId: job.id,
      status: job.status,
      attemptId: job.attemptId,
      applied,
    });
    if (job.status === "SUCCEEDED" || job.status === "FAILED" || job.attemptId !== input.attemptId)
      return ack(false);
    // 미전달 확정은 미시작 Job에만 적용한다. null 자체를 미전달의 근거로 삼지 않는다.
    if (
      input.status === "FAILED" &&
      input.errorCode === "ENQUEUE_FAILED" &&
      (job.status !== "QUEUED" || job.attemptId !== null || job.enqueuedAt !== null)
    )
      return ack(false);
    let status = input.status;
    let errorCode = input.status === "FAILED" ? input.errorCode : null;
    if (input.status === "SUCCEEDED") {
      if (song.youtubeId !== job.videoId || input.result.source.id !== job.videoId) {
        status = "FAILED";
        errorCode = "SOURCE_CHANGED";
      } else
        await storeWaveform(tx, { songId: job.songId, videoId: job.videoId, data: input.result });
    }
    await updateWaveformJob(tx, job.id, {
      status,
      errorCode,
      finishedAt: new Date().toISOString(),
    });
    for (const requester of await findWaveformRequesters(tx, job.id))
      await recordWaveformNotification(tx, {
        accountId: requester.accountId,
        jobId: job.id,
        type: status === "SUCCEEDED" ? "WAVEFORM_SUCCEEDED" : "WAVEFORM_FAILED",
      });
    return { ...ack(true), status };
  });
}
