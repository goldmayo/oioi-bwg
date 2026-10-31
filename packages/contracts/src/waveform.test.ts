import { expect, it } from "vitest";
import { waveformDataSchema, waveformTerminalAckSchema, waveformStartAckSchema } from "./waveform";
const valid = {
  durationMs: 40,
  bucketSizeMs: 20,
  peaks: {
    version: 2,
    channels: 1,
    sample_rate: 24000,
    samples_per_pixel: 480,
    bits: 8,
    length: 2,
    data: [-20, 20, -10, 10],
  },
  source: { type: "youtube", id: "abcdefghijk" },
  generationVersion: 1,
};
it("BBC mono JSON의 길이·min/max·시간 metadata 일치를 확인한다", () => {
  expect(waveformDataSchema.safeParse(valid).success).toBe(true);
  for (const peaks of [
    { ...valid.peaks, data: [10, -10, -10, 10] },
    { ...valid.peaks, length: 3 },
    { ...valid.peaks, channels: undefined },
    { ...valid.peaks, data: [-129, 20, -10, 10] },
  ])
    expect(waveformDataSchema.safeParse({ ...valid, peaks }).success).toBe(false);
  for (const extra of [{ durationMs: 61 }, { bucketSizeMs: 30 }])
    expect(waveformDataSchema.safeParse({ ...valid, ...extra }).success).toBe(false);
});
it("반영 완료 ACK는 terminal이어야 하며 이전 attempt 무시는 RUNNING을 반환할 수 있다", () => {
  const ack = {
    jobId: "019a0170-0000-7000-8000-000000000001",
    attemptId: null,
    status: "RUNNING",
    applied: false,
  };
  expect(waveformTerminalAckSchema.safeParse(ack).success).toBe(true);
  expect(waveformTerminalAckSchema.safeParse({ ...ack, applied: true }).success).toBe(false);
  expect(
    waveformTerminalAckSchema.safeParse({ ...ack, applied: true, status: "FAILED" }).success,
  ).toBe(true);
});

it("시작 허가는 RUNNING과 유효한 attempt를 함께 반환해야 한다", () => {
  const snapshot = {
    id: "019a0170-0000-7000-8000-000000000001",
    songId: "019a0170-0000-7000-8000-000000000001",
    videoId: "abcdefghijk",
    status: "RUNNING",
    attemptId: null,
    enqueuedAt: null,
    started: true,
  };
  expect(waveformStartAckSchema.safeParse(snapshot).success).toBe(false);
  expect(waveformStartAckSchema.safeParse({ ...snapshot, attemptId: snapshot.id }).success).toBe(
    true,
  );
  expect(
    waveformStartAckSchema.safeParse({ ...snapshot, attemptId: snapshot.id, status: "FAILED" })
      .success,
  ).toBe(false);
});

it("작업 파일은 단일 v1 계약이며 잘못된 실행 입력을 거절한다", async () => {
  const { waveformManifestSchema } = await import("./waveform");
  expect(waveformManifestSchema.parse({ version: 1, videoIds: ["pbELDkeLdho"] })).toEqual({
    version: 1,
    videoIds: ["pbELDkeLdho"],
  });
  for (const input of [
    { version: 2, videoIds: ["pbELDkeLdho"] },
    { version: 1, videoIds: [] },
    { version: 1, videoIds: ["pbELDkeLdho", "pbELDkeLdho"] },
    { version: 1, videoIds: ["https://youtu.be/pbELDkeLdho"] },
    { version: 1, videoIds: ["pbELDkeLdho"], command: "anything" },
  ])
    expect(waveformManifestSchema.safeParse(input).success).toBe(false);
});
