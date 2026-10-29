import type { WaveformData } from "@oioi-bwg/contracts/waveform";
import { expect, it } from "vitest";

import { createPeaksDisplayData } from "./peaks-display-data";
it("표시 반복은 세 anchor의 시간·진폭과 총 duration, 원본 JSON을 보존한다", () => {
  const data = {
    durationMs: 60,
    bucketSizeMs: 20,
    generationVersion: 1,
    source: { type: "youtube", id: "abcdefghijk" },
    peaks: {
      version: 1,
      bits: 8,
      sample_rate: 24000,
      samples_per_pixel: 480,
      length: 3,
      data: [-10, 10, -20, 20, -30, 30],
    },
  } as WaveformData;
  const original = structuredClone(data);
  const display = createPeaksDisplayData(data);
  expect(display.minimumBucketMs).toBe(5);
  for (const time of [0, 20, 40]) {
    const index = Math.floor(time / display.minimumBucketMs) * 2;
    expect(display.json.data.slice(index, index + 2)).toEqual(
      data.peaks.data.slice(time / 10, time / 10 + 2),
    );
  }
  expect(
    ((display.json.length * display.json.samples_per_pixel) / display.json.sample_rate) * 1000,
  ).toBe(data.durationMs);
  expect(data).toEqual(original);
});
