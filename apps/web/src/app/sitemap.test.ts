import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/config/site", () => ({ SITE_CONFIG: { url: "https://www.oioibawige.com" } }));
vi.mock("@oioi-bwg/server/services/song-service", () => ({
  listVisibleSongsForSitemap: async () => [
    { slug: "tbh", updatedAt: "2026-10-20T01:00:00Z" },
    { slug: "missing-date", updatedAt: null },
    { slug: "invalid-date", updatedAt: "invalid" },
  ],
}));
vi.mock("@oioi-bwg/server/services/album-service", () => ({
  listVisibleAlbumsWithSongs: async () => [{ slug: "내 앨범" }],
}));

import sitemap from "./sitemap";

describe("public sitemap", () => {
  it("lists discoverable static pages, albums and songs with canonical www URLs", async () => {
    const entries = await sitemap();
    expect(entries.map((entry) => entry.url)).toEqual([
      "https://www.oioibawige.com/",
      "https://www.oioibawige.com/chants",
      "https://www.oioibawige.com/more",
      "https://www.oioibawige.com/more/notice",
      "https://www.oioibawige.com/more/updates",
      "https://www.oioibawige.com/more/policy",
      "https://www.oioibawige.com/albums/%EB%82%B4%20%EC%95%A8%EB%B2%94",
      "https://www.oioibawige.com/songs/tbh",
      "https://www.oioibawige.com/songs/missing-date",
      "https://www.oioibawige.com/songs/invalid-date",
    ]);
  });

  it("uses content dates and never invents a last modification time", async () => {
    const entries = await sitemap();
    expect(entries[0]).not.toHaveProperty("lastModified");
    expect(entries.find((entry) => entry.url.endsWith("/tbh"))?.lastModified).toEqual(
      new Date("2026-10-20T01:00:00Z"),
    );
    for (const slug of ["missing-date", "invalid-date"]) {
      expect(entries.find((entry) => entry.url.endsWith(`/${slug}`))).not.toHaveProperty(
        "lastModified",
      );
    }
  });
});
