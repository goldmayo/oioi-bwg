import "server-only";
import type { WaveformJob, WaveformTerminal } from "@oioi-bwg/contracts/waveform";
import { requireUser, type RequestContext } from "../auth/request-context";
import { getDatabase } from "../db";
import { createEntityId } from "../db/entity-id";
import { AppError } from "../errors/app-error";
import {
  findActiveWaveformJob,
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
/** 서비스 토큰을 검증한 Console 내부 adapter만 호출한다. */
export async function getRunnerWaveformJob(id: string) {
  const row = await findWaveformJob(getDatabase(), id);
  if (!row) throw new AppError("WAVEFORM_JOB_NOT_FOUND");
  const { job } = row;
  return {
    id: job.id,
    songId: job.songId,
    videoId: job.videoId,
    status: job.status,
    attemptId: job.attemptId,
    enqueuedAt: job.enqueuedAt ? new Date(job.enqueuedAt).toISOString() : null,
  };
}
/** 아직 HTTP 생성 경로를 공개하지 않는다. 승인된 source/Runner 관문을 통과한 adapter만 호출한다. */
export async function requestWaveformJob(ctx: RequestContext, songId: string) {
  const accountId = admin(ctx);
  return getDatabase().transaction(async (tx) => {
    const song = await lockWaveformSong(tx, songId);
    if (!song) throw new AppError("SONG_NOT_FOUND");
    if (!song.youtubeId || !/^[A-Za-z0-9_-]{11}$/.test(song.youtubeId))
      throw new AppError("WAVEFORM_SOURCE_INVALID");
    const existing = await findActiveWaveformJob(tx, songId, song.youtubeId);
    const job = existing ?? (await insertWaveformJob(tx, songId, song.youtubeId));
    // Song → Job → requester 순서를 terminal 경로와 통일한다.
    await lockWaveformJob(tx, job.id);
    await insertWaveformRequester(tx, job.id, accountId);
    return { job: project({ job, slug: song.slug }), created: !existing };
  });
}
/** Runner가 visibility 소유권과 이전 container 정리를 확인한 뒤 호출할 내부 use case다. */
export async function startWaveformJob(id: string) {
  const found = await findWaveformJob(getDatabase(), id);
  if (!found) throw new AppError("WAVEFORM_JOB_NOT_FOUND");
  return getDatabase().transaction(async (tx) => {
    await lockWaveformSong(tx, found.job.songId);
    const job = await lockWaveformJob(tx, id);
    if (!job || job.status === "SUCCEEDED" || job.status === "FAILED") return null;
    const attemptId = createEntityId();
    await updateWaveformJob(tx, id, {
      status: "RUNNING",
      attemptId,
      startedAt: new Date().toISOString(),
    });
    return attemptId;
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
