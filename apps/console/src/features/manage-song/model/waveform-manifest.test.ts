import { expect, it } from "vitest";

import { createWaveformDownload } from "./waveform-manifest";

it("한국 시간의 날짜 경계를 반영하고 선택 순서의 유효한 작업 파일을 만든다", () => {
  const file = createWaveformDownload(
    [
      { title: "곡 A", youtubeId: "pbELDkeLdho" },
      { title: "곡 B", youtubeId: "abcdefghijk" },
    ],
    new Date("2026-10-30T15:00:00.123Z"),
  );
  expect(file.filename).toBe("oioi-operator-waveform_20261031_000000_123_KST.json");
  expect(JSON.parse(file.content)).toEqual({
    version: 1,
    videoIds: ["pbELDkeLdho", "abcdefghijk"],
  });
});
it("잘못된 곡을 조용히 제외하지 않고 곡명으로 안내한다", () => {
  expect(() => createWaveformDownload([])).toThrow("선택");
  for (const youtubeId of ["", "https://youtu.be/pbELDkeLdho", "pbELDkeLdho "]) {
    expect(() => createWaveformDownload([{ title: "문제 곡", youtubeId }])).toThrow("문제 곡");
  }
  expect(() =>
    createWaveformDownload([
      { title: "곡 A", youtubeId: "pbELDkeLdho" },
      { title: "중복 곡", youtubeId: "pbELDkeLdho" },
    ]),
  ).toThrow("중복 곡");
});
