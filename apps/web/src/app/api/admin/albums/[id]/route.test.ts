import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { albumSummarySchema } from "@/shared/contracts/album";
import { apiErrorResponseSchema } from "@/shared/contracts/error";

const getRequestContext = vi.hoisted(() => vi.fn());
const deleteAlbum = vi.hoisted(() => vi.fn());
const editAlbum = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/request-context", () => ({ getRequestContext }));
vi.mock("@/server/services/album-service", () => ({ deleteAlbum, editAlbum }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { DELETE, PATCH } from "./route";

const context = { ability: {}, user: { id: "1" } };
const routeContext = { params: Promise.resolve({ id: "1" }) };
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

describe("/api/admin/albums/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestContext.mockResolvedValue(context);
  });

  it("updates an album with a validated path and body", async () => {
    editAlbum.mockResolvedValue(album);
    const { id: _id, createdAt: _createdAt, ...input } = album;

    const response = await PATCH(
      new Request("https://example.test/api/admin/albums/1", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(albumSummarySchema.parse(await response.json())).toEqual(album);
    expect(editAlbum).toHaveBeenCalledWith(context, 1, input);
  });

  it("returns 204 after deleting an album", async () => {
    deleteAlbum.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("https://example.test/api/admin/albums/1", { method: "DELETE" }),
      routeContext,
    );

    expect(response.status).toBe(204);
    expect(deleteAlbum).toHaveBeenCalledWith(context, 1);
  });

  it("maps a missing album to 404", async () => {
    deleteAlbum.mockRejectedValue(new AppError("ALBUM_NOT_FOUND"));

    const response = await DELETE(
      new Request("https://example.test/api/admin/albums/1", { method: "DELETE" }),
      routeContext,
    );

    expect(response.status).toBe(404);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("ALBUM_NOT_FOUND");
  });
});
