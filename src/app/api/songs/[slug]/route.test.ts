import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { apiErrorResponseSchema } from "@/shared/contracts/error";
import { songDetailSchema } from "@/shared/contracts/song";

const requireSongDetailBySlug = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/services/song-service", () => ({ requireSongDetailBySlug }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { GET } from "./route";

const song = {
  id: 104,
  title: "Harmony",
  slug: "harmony",
  youtubeId: "abcdefghijk",
  lyrics: [],
  hasOfficialCheer: false,
  isTitle: true,
  order: 1,
  album: {
    id: 1,
    name: "Harmony",
    slug: "harmony-album",
    imgUrl: "https://assets.oioibawige.com/harmony.webp",
    color: "#000000",
    releaseDate: null,
    isVisible: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    songs: [],
  },
};

const context = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("GET /api/songs/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a contract-validated public song", async () => {
    requireSongDetailBySlug.mockResolvedValue(song);

    const response = await GET(
      new Request("https://example.test/api/songs/harmony"),
      context("harmony"),
    );

    expect(response.status).toBe(200);
    expect(songDetailSchema.parse(await response.json())).toEqual(song);
    expect(requireSongDetailBySlug).toHaveBeenCalledWith("harmony");
  });

  it("returns a safe validation failure for an invalid slug", async () => {
    const response = await GET(new Request("https://example.test/api/songs/%20"), context(" "));

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("VALIDATION_ERROR");
  });

  it("maps an expected missing song to 404", async () => {
    requireSongDetailBySlug.mockRejectedValue(new AppError("SONG_NOT_FOUND"));

    const response = await GET(
      new Request("https://example.test/api/songs/missing"),
      context("missing"),
    );

    expect(response.status).toBe(404);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("SONG_NOT_FOUND");
  });
});
