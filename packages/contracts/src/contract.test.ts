import { publishedCheerGuideSchema } from "./song";
import { describe, expect, it } from "vitest";

import { albumDetailSchema } from "./album";
import { apiErrorResponseSchema } from "./error";
import { songDetailSchema, saveAdminSongLyricsSchema, adminSongMutationResultSchema } from "./song";

const album = {
  id: "019a0170-0000-7000-8000-000000000001",
  name: "IVE SWITCH",
  slug: "ive-switch",
  imgUrl: "https://assets.oioibawige.com/ive-switch.webp",
  color: "#000000",
  releaseDate: "2024-04-29T00:00:00.000Z",
  isVisible: true,
  createdAt: "2024-04-29T00:00:00.000Z",
  songs: [
    {
      id: "019a0170-0000-7000-8000-000000000068",
      title: "해야 (HEYA)",
      slug: "heya",
      youtubeId: "07EzMbVH3QE",
      hasOfficialCheer: true,
      isTitle: true,
    },
  ],
};

describe("public API contracts", () => {
  it("accepts an album detail with renderable songs only", () => {
    expect(albumDetailSchema.parse(album)).toEqual(album);
  });

  it("requires lyrics to match the cheer-guide contract", () => {
    expect(
      songDetailSchema.safeParse({
        id: "019a0170-0000-7000-8000-000000000068",
        title: "해야 (HEYA)",
        slug: "heya",
        youtubeId: "07EzMbVH3QE",
        lyrics: [{ startTime: 0, segments: [{ text: "해야" }], isExtra: false }],
        hasOfficialCheer: true,
        isTitle: true,
        order: 1,
        album,
      }).success,
    ).toBe(true);
  });

  it("rejects malformed error payloads", () => {
    expect(apiErrorResponseSchema.safeParse({ code: "SONG_NOT_FOUND" }).success).toBe(false);
  });
});

it("keeps the guide version through save requests/responses and rejects invalid bindings", () => {
  const guideWrite = { guideId: album.id, lockVersion: 2 };
  const request = { lyrics: [], youtubeId: "video", guideWrite };
  expect(saveAdminSongLyricsSchema.parse(request)).toEqual(request);
  expect(adminSongMutationResultSchema.parse({ id: album.id, guideWrite })).toEqual({
    id: album.id,
    guideWrite,
  });
  for (const invalid of [
    { ...guideWrite, lockVersion: 0 },
    { ...guideWrite, lockVersion: 1.5 },
    { ...guideWrite, guideId: "123" },
  ]) {
    expect(saveAdminSongLyricsSchema.safeParse({ ...request, guideWrite: invalid }).success).toBe(
      false,
    );
  }
});

it("accepts distinct published modes and rejects duplicate identity/mode or missing official sources", () => {
  const guide = {
    id: album.id,
    mode: "CONCERT",
    sourceType: "FANDOM",
    sourceUrl: null,
    guideVideoUrl: null,
    description: null,
    lyrics: [{ startTime: 1, segments: [{ text: "네임콜" }], isExtra: false }],
  };
  const field = songDetailSchema.shape.cheerGuides;
  expect(
    field.safeParse([guide, { ...guide, id: album.songs[0].id, mode: "FESTIVAL" }]).success,
  ).toBe(true);
  expect(field.safeParse([guide, { ...guide, mode: "FESTIVAL" }]).success).toBe(false);
  expect(field.safeParse([guide, { ...guide, id: album.songs[0].id }]).success).toBe(false);
  expect(publishedCheerGuideSchema.safeParse({ ...guide, sourceType: "OFFICIAL" }).success).toBe(
    false,
  );
});
