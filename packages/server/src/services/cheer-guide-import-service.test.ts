import { describe, expect, it } from "vitest";
import {
  legacyGuideImportManifestSchema,
  legacyGuideSourceFingerprint,
} from "./cheer-guide-import-service";

const source = {
  youtubeId: "timing-video",
  hasOfficialCheer: null,
  lyrics: [
    {
      startTime: 1.125,
      isExtra: true,
      segments: [{ text: "네임콜", isCheer: true, isEcho: false, startTimeOffset: 0.3 }],
    },
  ],
};
const entry = {
  songId: "019a0170-0000-7000-8000-000000000001",
  guideId: "019a0170-0000-7000-8000-000000000002",
  snapshotId: "019a0170-0000-7000-8000-000000000003",
  publicationId: "019a0170-0000-7000-8000-000000000004",
  sourceFingerprint: legacyGuideSourceFingerprint(source),
  referenceYoutubeId: source.youtubeId,
  mode: "CONCERT",
  legacyWriteTarget: true,
  sourceType: "FANDOM",
  sourceUrl: null,
  guideVideoUrl: null,
  description: null,
};
describe("검토 대응표와 원본 fingerprint", () => {
  it("JSON 키 순서가 바뀌어도 같고 타이밍·원본 flag 변화는 감지한다", () => {
    const reversed = {
      ...source,
      lyrics: [{ segments: source.lyrics[0].segments, isExtra: true, startTime: 1.125 }],
    };
    expect(legacyGuideSourceFingerprint(reversed)).toBe(entry.sourceFingerprint);
    expect(legacyGuideSourceFingerprint({ ...source, hasOfficialCheer: false })).not.toBe(
      entry.sourceFingerprint,
    );
    expect(
      legacyGuideSourceFingerprint({
        ...source,
        lyrics: [{ ...source.lyrics[0], startTime: 1.126 }],
      }),
    ).not.toBe(entry.sourceFingerprint);
  });
  it("미분류·중복 ID와 안전하지 않은 출처 링크를 거절한다", () => {
    for (const patch of [
      { mode: null },
      { sourceType: null },
      { sourceType: "OFFICIAL" },
      { sourceUrl: "javascript:alert(1)" },
      { guideVideoUrl: "file:///video" },
      { snapshotId: entry.guideId },
    ])
      expect(
        legacyGuideImportManifestSchema.safeParse({ version: 1, entries: [{ ...entry, ...patch }] })
          .success,
      ).toBe(false);
    expect(
      legacyGuideImportManifestSchema.safeParse({ version: 1, entries: [entry, entry] }).success,
    ).toBe(false);
  });
  it("모드와 출처를 명시한 검토용 곡 메타데이터를 보존한다", () => {
    const reviewed = {
      ...entry,
      sourceType: "OFFICIAL",
      sourceUrl: "https://weverse.io/qwer/notice/33922",
      title: "행복해져라",
      slug: "song",
    };
    expect(
      legacyGuideImportManifestSchema.parse({
        version: 1,
        entries: [reviewed],
        excludedSongIds: [],
      }).entries,
    ).toEqual([reviewed]);
  });
});
