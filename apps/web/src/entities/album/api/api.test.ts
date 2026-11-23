import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import { http as handlers, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";

import { http } from "@/shared/api/http-client";
import { ApiError } from "@/shared/api/http-errors";

import { albumQueryKeys } from "../index";

import { getAlbumDetail } from "./api";
import { albumQueries } from "./index";

const server = createHttpTestServer(window.location.href);
const album = {
  id: "019a0170-0000-7000-8000-000000000001",
  name: "MANITO",
  slug: "manito",
  imgUrl: "https://assets.example.com/manito.webp",
  color: "#E85A9A",
  releaseDate: null,
  isVisible: true,
  createdAt: "2026-01-01T00:00:00.000Z",
  songs: [],
};

test("public album requests keep the encoded slug, cancellation and query identity", async () => {
  const signal = new AbortController().signal;
  vi.spyOn(http, "get");
  const respond = vi.fn((_info: { request: Request }) => HttpResponse.json({ invalid: true }));
  server.use(handlers.get("*/api/albums/:slug", respond));
  await expect(getAlbumDetail("space / slug", signal)).rejects.toThrow(
    "API response contract violation",
  );
  expect(http.get).toHaveBeenCalledWith("/api/albums/space%20%2F%20slug", { signal });
  expect(new URL(respond.mock.calls[0][0].request.url).pathname).toBe(
    "/api/albums/space%20%2F%20slug",
  );
  expect(albumQueries.detail("fixture").queryKey).toEqual(albumQueryKeys.detail("fixture"));
});

test("공개 앨범 DTO를 HTTP 응답에서 읽는다", async () => {
  server.use(handlers.get("*/api/albums/:slug", () => HttpResponse.json(album)));
  await expect(getAlbumDetail("manito")).resolves.toEqual(album);
});

test("앨범 없음 오류를 정규화한다", async () => {
  server.use(
    handlers.get("*/api/albums/:slug", () =>
      HttpResponse.json(
        { code: "ALBUM_NOT_FOUND", message: "앨범을 찾을 수 없습니다." },
        { status: 404 },
      ),
    ),
  );
  const result = getAlbumDetail("missing");
  await expect(result).rejects.toBeInstanceOf(ApiError);
  await expect(result).rejects.toMatchObject({ status: 404, code: "ALBUM_NOT_FOUND" });
});

test("이미 취소한 signal은 HTTP 요청을 중단한다", async () => {
  server.use(handlers.get("*/api/albums/:slug", () => HttpResponse.json(album)));
  const controller = new AbortController();
  controller.abort();
  await expect(getAlbumDetail("manito", controller.signal)).rejects.toMatchObject({
    name: "AbortError",
  });
});
