import { expect, it } from "vitest";
import { waveformDataSchema } from "./waveform";
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
