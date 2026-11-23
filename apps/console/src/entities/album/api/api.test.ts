import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import { http as handlers, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { http } from "@/shared/api/http-client";
import { ApiError } from "@/shared/api/http-errors";

import { albumQueryKeys } from "../index";

import { createAdminAlbum, deleteAdminAlbum, getAdminAlbums, updateAdminAlbum } from "./api";
import { albumQueries } from "./index";

const server = createHttpTestServer(window.location.href);
beforeEach(() => {
  vi.spyOn(http, "get");
  vi.spyOn(http, "post");
  vi.spyOn(http, "patch");
  vi.spyOn(http, "delete");
});

const album = {
  id: "019a0170-0000-7000-8000-000000000001",
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

describe("album browser API", () => {
  it("shares entity query keys across server and client consumers", () => {
    expect(albumQueryKeys.detail("manito")).toEqual(["album", "detail", "manito"]);
    expect(albumQueryKeys.adminList()).toEqual(["album", "list", "admin"]);
    expect(albumQueries.adminList().queryKey).toEqual(albumQueryKeys.adminList());
  });

  it("validates the admin album list response", async () => {
    const controller = new AbortController();
    const list = { items: [album], nextCursor: null };
    server.use(handlers.get("*/api/admin/albums", () => HttpResponse.json(list)));

    await expect(getAdminAlbums(controller.signal)).resolves.toEqual(list);
    expect(http.get).toHaveBeenCalledWith("/api/admin/albums", {
      signal: controller.signal,
    });
  });

  it("rejects an invalid response contract", async () => {
    server.use(
      handlers.get("*/api/admin/albums", () => HttpResponse.json([album]), { once: true }),
      handlers.get("*/api/admin/albums", () =>
        HttpResponse.json({ items: [{ ...album, id: 1 }], nextCursor: null }),
      ),
    );

    await expect(getAdminAlbums()).rejects.toThrow("API response contract violation");
    await expect(getAdminAlbums()).rejects.toThrow("API response contract violation");
  });

  it("uses the admin mutation endpoints", async () => {
    const bodies: unknown[] = [];
    const save = async ({ request }: { request: Request }) => {
      bodies.push(await request.json());
      return HttpResponse.json(album);
    };
    server.use(
      handlers.post("*/api/admin/albums", save),
      handlers.patch("*/api/admin/albums/:id", save),
      handlers.delete("*/api/admin/albums/:id", () => new HttpResponse(null, { status: 204 })),
    );

    await expect(createAdminAlbum(input)).resolves.toEqual(album);
    await expect(updateAdminAlbum(album.id, input)).resolves.toEqual(album);
    await expect(deleteAdminAlbum(album.id)).resolves.toBeUndefined();

    expect(bodies).toEqual([input, input]);
    expect(http.post).toHaveBeenCalledWith("/api/admin/albums", { json: input });
    expect(http.patch).toHaveBeenCalledWith(
      "/api/admin/albums/019a0170-0000-7000-8000-000000000001",
      { json: input },
    );
    expect(http.delete).toHaveBeenCalledWith(
      "/api/admin/albums/019a0170-0000-7000-8000-000000000001",
    );
  });
});

it("권한 거부 HTTP 응답을 ApiError로 전달한다", async () => {
  server.use(
    handlers.get("*/api/admin/albums", () =>
      HttpResponse.json({ code: "FORBIDDEN", message: "접근 권한이 없습니다." }, { status: 403 }),
    ),
  );
  const result = getAdminAlbums();
  await expect(result).rejects.toBeInstanceOf(ApiError);
  await expect(result).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
});
