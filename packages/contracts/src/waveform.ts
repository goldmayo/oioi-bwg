import { z } from "zod";
import { entityIdSchema } from "./entity-id";
export const waveformStatusSchema = z.enum(["QUEUED", "RUNNING", "SUCCEEDED", "FAILED"]);
export const waveformErrorSchema = z.enum([
  "ENQUEUE_FAILED",
  "PROCESSING_FAILED",
  "DLQ",
  "DELIVERY_EXPIRED",
  "SOURCE_CHANGED",
]);
// BBC mono 8-bit JSON. 크기·시간 한도는 내부 결과 입력의 상한이며 분석 성능 보장이 아니다.
const peaksSchema = z.object({
  version: z.union([z.literal(1), z.literal(2)]),
  channels: z.literal(1).optional(),
  sample_rate: z.number().int().min(1).max(192000),
  samples_per_pixel: z.number().int().positive(),
  bits: z.literal(8),
  length: z.number().int().min(1).max(180000),
  data: z.array(z.number().int().min(-128).max(127)).max(360000),
});
export const waveformDataSchema = z
  .object({
    durationMs: z.number().int().min(1).max(3600000),
    bucketSizeMs: z.number().positive(),
    peaks: peaksSchema,
    source: z.object({ type: z.literal("youtube"), id: z.string().regex(/^[A-Za-z0-9_-]{11}$/) }),
    generationVersion: z.literal(1),
  })
  .superRefine((value, ctx) => {
    const { peaks, durationMs, bucketSizeMs } = value;
    const bucket = (peaks.samples_per_pixel * 1000) / peaks.sample_rate;
    if (
      (peaks.version === 2 && peaks.channels !== 1) ||
      peaks.data.length !== peaks.length * 2 ||
      Math.abs(bucket - bucketSizeMs) > 0.001 ||
      durationMs > peaks.length * bucket + 1 ||
      durationMs <= (peaks.length - 1) * bucket - 1 ||
      JSON.stringify(value).length > 4 * 1024 * 1024
    )
      ctx.addIssue({ code: "custom", message: "파형 메타데이터가 일치하지 않습니다." });
    for (let i = 0; i < peaks.data.length; i += 2)
      if (peaks.data[i]! > peaks.data[i + 1]!) {
        ctx.addIssue({ code: "custom", message: "파형 최솟값이 최댓값보다 큽니다." });
        break;
      }
  });
export const waveformJobSchema = z.object({
  id: entityIdSchema,
  songId: entityIdSchema,
  videoId: z.string(),
  status: waveformStatusSchema,
  errorCode: waveformErrorSchema.nullable(),
  createdAt: z.iso.datetime({ offset: true }),
  finishedAt: z.iso.datetime({ offset: true }).nullable(),
  editorHref: z.string().startsWith("/admin/edit/").nullable(),
});
export type WaveformData = z.infer<typeof waveformDataSchema>;
export type WaveformJob = z.infer<typeof waveformJobSchema>;
export const waveformTerminalSchema = z.discriminatedUnion("status", [
  z.object({
    jobId: entityIdSchema,
    attemptId: entityIdSchema,
    status: z.literal("SUCCEEDED"),
    result: waveformDataSchema,
  }),
  z.object({
    jobId: entityIdSchema,
    attemptId: entityIdSchema.nullable(),
    status: z.literal("FAILED"),
    errorCode: waveformErrorSchema,
  }),
]);
export type WaveformTerminal = z.infer<typeof waveformTerminalSchema>;
/** 인증된 Runner만 소비하는 최소 상태 projection이다. */
export const waveformRunnerJobSchema = waveformJobSchema
  .pick({ id: true, songId: true, videoId: true, status: true })
  .extend({
    attemptId: entityIdSchema.nullable(),
    enqueuedAt: z.iso.datetime({ offset: true }).nullable(),
  });
export const waveformTerminalAckSchema = z
  .object({
    jobId: entityIdSchema,
    status: waveformStatusSchema,
    attemptId: entityIdSchema.nullable(),
    applied: z.boolean(),
  })
  .refine((value) => !value.applied || value.status === "SUCCEEDED" || value.status === "FAILED");

// Queue와 socket은 세 식별자만 전달하며 실행 설정을 받지 않는다.
export const waveformQueuePayloadSchema = z.strictObject({
  jobId: entityIdSchema,
  songId: entityIdSchema,
  videoId: z.string().regex(/^[A-Za-z0-9_-]{11}$/),
});
export const waveformEnqueuedInputSchema = waveformQueuePayloadSchema.extend({
  enqueuedAt: z.iso.datetime({ offset: true }),
});
export const waveformStartInputSchema = waveformQueuePayloadSchema.extend({
  expectedAttemptId: entityIdSchema.nullable(),
});
export const waveformStartAckSchema = waveformRunnerJobSchema
  .extend({ started: z.boolean() })
  .refine((value) => !value.started || (value.status === "RUNNING" && value.attemptId !== null));
export type WaveformQueuePayload = z.infer<typeof waveformQueuePayloadSchema>;
export type WaveformEnqueuedInput = z.infer<typeof waveformEnqueuedInputSchema>;
export type WaveformStartInput = z.infer<typeof waveformStartInputSchema>;
// Runner는 Put이 실행되지 않았음이 확실한 경우에만 NOT_ENQUEUED를 반환한다.
export const waveformEnqueueAckSchema = z.strictObject({
  jobId: entityIdSchema,
  outcome: z.enum(["ENQUEUED", "UNCONFIRMED", "NOT_ENQUEUED"]),
});
export type WaveformEnqueueOutcome = z.infer<typeof waveformEnqueueAckSchema>["outcome"];
export const waveformRequestSchema = z.strictObject({ songId: entityIdSchema });
export const waveformAcceptedSchema = z.strictObject({ jobId: entityIdSchema });

/** Console 선택 다운로드와 로컬 운영 CLI 사이의 v1 작업 파일. */
export const waveformManifestSchema = z
  .strictObject({
    version: z.literal(1),
    videoIds: z.array(z.string().regex(/^[A-Za-z0-9_-]{11}$/)).min(1),
  })
  .refine((value) => new Set(value.videoIds).size === value.videoIds.length, {
    message: "영상 ID가 중복되었습니다.",
  });
export type WaveformManifest = z.infer<typeof waveformManifestSchema>;
