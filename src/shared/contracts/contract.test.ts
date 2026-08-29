import { describe, expect, it } from "vitest";

import { albumDetailSchema } from "./album";
import { apiErrorResponseSchema } from "./error";
import { songDetailSchema } from "./song";

const album = {
  id: 1,
  name: "IVE SWITCH",
  slug: "ive-switch",
  imgUrl: "https://assets.oioibawige.com/ive-switch.webp",
  color: "#000000",
  releaseDate: "2024-04-29T00:00:00.000Z",
  isVisible: true,
  createdAt: "2024-04-29T00:00:00.000Z",
  songs: [
    {
      id: 104,
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
        id: 104,
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
