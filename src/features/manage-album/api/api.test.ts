import { afterEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/shared/api/http-client", () => ({ http }));

import { createAdminAlbum, deleteAdminAlbum, getAdminAlbums, updateAdminAlbum } from "./api";
import { adminAlbumQueries } from "./queries";
import { adminAlbumQueryKeys } from "./query-keys";

const album = {
  id: 1,
  name: "MANITO",
  slug: "manito",
  imgUrl: "https://assets.example.com/manito.webp",
  color: "#E85A9A",
  releaseDate: "2024-04-01T00:00:00.000Z",
  isVisible: true,
  createdAt: "2026-04-02T18:00:57.794Z",
};

const input = {
  name: album.name,
  slug: album.slug,
  imgUrl: album.imgUrl,
  color: album.color,
  releaseDate: album.releaseDate,
  isVisible: album.isVisible,
};

afterEach(() => {
  vi.clearAllMocks();
});

describe("manage-album API", () => {
  it("shares the admin album query key across server and client consumers", () => {
    expect(adminAlbumQueryKeys.albums.queryKey).toEqual(["admin", "albums"]);
    expect(adminAlbumQueries.list().queryKey).toEqual(adminAlbumQueryKeys.albums.queryKey);
  });

  it("validates the album list response", async () => {
    const controller = new AbortController();
    http.get.mockResolvedValue([album]);

    await expect(getAdminAlbums(controller.signal)).resolves.toEqual([album]);
    expect(http.get).toHaveBeenCalledWith("/api/admin/albums", {
      signal: controller.signal,
    });
  });

  it("rejects an invalid response contract", async () => {
    http.get.mockResolvedValue([{ ...album, id: "1" }]);

    await expect(getAdminAlbums()).rejects.toThrow("API response contract violation");
  });

  it("uses the admin mutation endpoints", async () => {
    http.post.mockResolvedValue(album);
    http.patch.mockResolvedValue(album);
    http.delete.mockResolvedValue(undefined);

    await expect(createAdminAlbum(input)).resolves.toEqual(album);
    await expect(updateAdminAlbum(album.id, input)).resolves.toEqual(album);
    await expect(deleteAdminAlbum(album.id)).resolves.toBeUndefined();

    expect(http.post).toHaveBeenCalledWith("/api/admin/albums", { json: input });
    expect(http.patch).toHaveBeenCalledWith("/api/admin/albums/1", { json: input });
    expect(http.delete).toHaveBeenCalledWith("/api/admin/albums/1");
  });
});
