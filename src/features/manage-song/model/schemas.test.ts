import { describe, expect, it } from "vitest";

import { songEditSchema, songFormSchema, toAdminSongUpdate } from "./schemas";

const fields = {
  albumId: 1,
  title: "Test Song",
  slug: "test-song",
  youtubeId: "youtube-id",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 1,
};

describe("manage-song form schema", () => {
  it("requires a slug for create and permits an empty legacy slug for edit", () => {
    expect(songFormSchema.safeParse({ ...fields, slug: "", lrcText: "lyrics" }).success).toBe(
      false,
    );
    expect(songEditSchema.parse({ ...fields, slug: "" })).toMatchObject({ slug: "" });
  });

  it("maps an empty edit slug to null and preserves a first assignment", () => {
    expect(toAdminSongUpdate(songEditSchema.parse({ ...fields, slug: "" }))).toMatchObject({
      slug: null,
    });
    expect(toAdminSongUpdate(songEditSchema.parse(fields))).toMatchObject({ slug: "test-song" });
  });
});
