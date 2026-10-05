import { describe, expect, it, vi } from "vitest";

import { findAlbumBySlug } from "./album-repository";
import { findSongBySlug } from "./song-repository";

function inspectVisibilityCondition(
  findFirst: ReturnType<typeof vi.fn>,
  table: { slug: string; isVisible: string },
) {
  const options = findFirst.mock.calls[0][0] as {
    where: (
      table: { slug: string; isVisible: string },
      operators: {
        and: (...conditions: unknown[]) => unknown[];
        eq: (column: string, value: unknown) => { column: string; value: unknown };
      },
    ) => unknown[];
  };

  return options.where(table, {
    and: (...conditions) => conditions,
    eq: (column, value) => ({ column, value }),
  });
}

describe("public resource visibility", () => {
  it("requires a visible Album at the repository boundary", () => {
    const findFirst = vi.fn();
    findAlbumBySlug({ query: { album: { findFirst } } } as never, "harmony");

    expect(
      inspectVisibilityCondition(findFirst, { slug: "Album.slug", isVisible: "Album.isVisible" }),
    ).toEqual([
      { column: "Album.slug", value: "harmony" },
      { column: "Album.isVisible", value: true },
    ]);
  });

  it("requires a visible Song at the repository boundary", () => {
    const findFirst = vi.fn();
    findSongBySlug({ query: { song: { findFirst } } } as never, "harmony");

    expect(
      inspectVisibilityCondition(findFirst, { slug: "Song.slug", isVisible: "Song.isVisible" }),
    ).toEqual([
      { column: "Song.slug", value: "harmony" },
      { column: "Song.isVisible", value: true },
    ]);
  });
});
