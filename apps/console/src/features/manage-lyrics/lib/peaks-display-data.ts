import type { WaveformData } from "@oioi-bwg/contracts/waveform";

/** 20ms 원본의 min/max를 반복 표시한다. 분석값·duration·저장 JSON은 바꾸지 않는다. */
export function createPeaksDisplayData(data: WaveformData) {
  const peaks = data.peaks;
  const factor = peaks.samples_per_pixel % 4 === 0 ? 4 : 1;
  const values = new Array<number>(peaks.data.length * factor);
  for (let bucket = 0; bucket < peaks.length; bucket++) {
    for (let copy = 0; copy < factor; copy++) {
      const index = (bucket * factor + copy) * 2;
      values[index] = peaks.data[bucket * 2];
      values[index + 1] = peaks.data[bucket * 2 + 1];
    }
  }
  return {
    json: {
      ...peaks,
      channels: 1,
      samples_per_pixel: peaks.samples_per_pixel / factor,
      length: peaks.length * factor,
      data: values,
    },
    minimumBucketMs: data.bucketSizeMs / factor,
  };
}
