import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { albumDetailSchema } from "@/shared/contracts/album";
import { apiErrorResponseSchema } from "@/shared/contracts/error";

const requireAlbumDetailBySlug = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/services/album-service", () => ({ requireAlbumDetailBySlug }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { GET } from "./route";

const album = {
  id: 1,
  name: "Harmony",
  slug: "harmony",
  imgUrl: "https://assets.oioibawige.com/harmony.webp",
  color: "#000000",
  releaseDate: null,
  isVisible: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  songs: [],
};

const context = (slug: string) => ({ params: Promise.resolve({ slug }) });

describe("GET /api/albums/[slug]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a contract-validated public album", async () => {
    requireAlbumDetailBySlug.mockResolvedValue(album);

    const response = await GET(
      new Request("https://example.test/api/albums/harmony"),
      context("harmony"),
    );

    expect(response.status).toBe(200);
    expect(albumDetailSchema.parse(await response.json())).toEqual(album);
    expect(requireAlbumDetailBySlug).toHaveBeenCalledWith("harmony");
  });

  it("returns a safe validation failure for an invalid slug", async () => {
    const response = await GET(new Request("https://example.test/api/albums/%20"), context(" "));

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("VALIDATION_ERROR");
  });

  it("maps an expected missing album to 404", async () => {
    requireAlbumDetailBySlug.mockRejectedValue(new AppError("ALBUM_NOT_FOUND"));

    const response = await GET(
      new Request("https://example.test/api/albums/missing"),
      context("missing"),
    );

    expect(response.status).toBe(404);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("ALBUM_NOT_FOUND");
  });
});
