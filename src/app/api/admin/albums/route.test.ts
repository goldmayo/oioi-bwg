import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { albumSummarySchema } from "@/shared/contracts/album";
import { apiErrorResponseSchema } from "@/shared/contracts/error";

const getRequestContext = vi.hoisted(() => vi.fn());
const createAlbum = vi.hoisted(() => vi.fn());
const listAdminAlbums = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/request-context", () => ({ getRequestContext }));
vi.mock("@/server/services/album-service", () => ({ createAlbum, listAdminAlbums }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { GET, POST } from "./route";

const context = { ability: {}, user: { id: "1" } };
const album = {
  color: "#000000",
  createdAt: "2026-01-01T00:00:00.000Z",
  id: 1,
  imgUrl: "https://assets.oioibawige.com/images/albums/test.webp",
  isVisible: true,
  name: "Test Album",
  releaseDate: null,
  slug: "test-album",
};

describe("/api/admin/albums", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestContext.mockResolvedValue(context);
  });

  it("returns the protected admin album list", async () => {
    listAdminAlbums.mockResolvedValue([album]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(albumSummarySchema.array().parse(await response.json())).toEqual([album]);
    expect(listAdminAlbums).toHaveBeenCalledWith(context);
  });

  it("creates an album with a validated contract", async () => {
    createAlbum.mockResolvedValue(album);
    const input = { ...album, id: undefined, createdAt: undefined };

    const response = await POST(
      new Request("https://example.test/api/admin/albums", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(albumSummarySchema.parse(await response.json())).toEqual(album);
    expect(createAlbum).toHaveBeenCalledWith(
      context,
      expect.objectContaining({ slug: "test-album" }),
    );
  });

  it("maps an unauthenticated admin request to 401", async () => {
    listAdminAlbums.mockRejectedValue(new AppError("UNAUTHENTICATED"));

    const response = await GET();

    expect(response.status).toBe(401);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("UNAUTHENTICATED");
  });
});
