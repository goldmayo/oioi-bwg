import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import type { QueryClient } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { http as handlers, HttpResponse } from "msw";
import { beforeEach as beforeHttp } from "vitest";
import { afterEach, expect, it, vi } from "vitest";

import type { AdminAlbumSummary } from "@/entities/album";
import { albumQueryKeys } from "@/entities/album";
import { cheerGuideQueryKeys } from "@/entities/cheer-guide";
import { songQueryKeys } from "@/entities/song";

import { http } from "@/shared/api/http-client";

import { createQueryClientFixture } from "../../../../tests/query-client";

import { useAlbumScreen } from "./use-album-screen";

const server = createHttpTestServer(window.location.href);
const createClient = createQueryClientFixture();
beforeHttp(() => {
  vi.spyOn(http, "post");
  vi.spyOn(http, "patch");
});

const album: AdminAlbumSummary = {
  id: "019a0170-0000-7000-8000-000000000001",
  name: "MANITO",
  slug: "manito",
  imgUrl: "https://assets.example.com/album.webp",
  color: "#ef87b5",
  releaseDate: null,
  isVisible: true,
  createdAt: "2026-11-02T00:00:00.000Z",
};
const values = {
  name: album.name,
  slug: album.slug,
  imgUrl: album.imgUrl!,
  color: album.color,
  releaseDate: "",
  isVisible: true,
};
let client: QueryClient;
afterEach(() => {
  cleanup();
  client?.clear();
  vi.resetAllMocks();
});
function setup(initial?: AdminAlbumSummary) {
  const fixture = createClient({ defaultOptions: { mutations: { retry: false } } });
  client = fixture.client;
  for (const queryKey of [
    albumQueryKeys.adminList(),
    songQueryKeys.adminList(),
    cheerGuideQueryKeys.adminList(),
  ])
    client.setQueryData(queryKey, { items: [], nextCursor: null });
  const onError = vi.fn();
  const hook = renderHook(() => useAlbumScreen(initial, onError), {
    wrapper: fixture.wrapper,
  });
  return { ...hook, onError };
}
it("생성은 기존 API로 빈 날짜를 null로 전달하고 목록을 무효화한다", async () => {
  server.use(handlers.post("*/api/admin/albums", () => HttpResponse.json(album)));
  const { result } = setup();
  await act(async () => {
    await result.current.submit(values);
  });
  expect(http.post).toHaveBeenCalledWith("/api/admin/albums", {
    json: { ...values, releaseDate: null },
  });
  expect(client.getQueryState(albumQueryKeys.adminList())?.isInvalidated).toBe(true);
  expect(client.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(false);
});
it.each([false, true])("이름 변경 %s에 따라 곡과 응원법 목록을 무효화한다", async (renamed) => {
  const name = renamed ? "새 앨범" : album.name;
  server.use(handlers.patch("*/api/admin/albums/:id", () => HttpResponse.json({ ...album, name })));
  const { result } = setup(album);
  await act(async () => {
    await result.current.submit({ ...values, name });
  });
  expect(http.patch).toHaveBeenCalledWith(`/api/admin/albums/${album.id}`, {
    json: { ...values, name, releaseDate: null },
  });
  expect(client.getQueryState(albumQueryKeys.adminList())?.isInvalidated).toBe(true);
  expect(client.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(renamed);
  expect(client.getQueryState(cheerGuideQueryKeys.adminList())?.isInvalidated).toBe(renamed);
});
it("실패는 재인증 조합에 전달하고 성공 캐시 처리를 실행하지 않는다", async () => {
  const error = new Error("저장 실패");
  server.use(
    handlers.patch("*/api/admin/albums/:id", () =>
      HttpResponse.json({ code: "INTERNAL_SERVER_ERROR", message: error.message }, { status: 500 }),
    ),
  );
  const { result, onError } = setup(album);
  let received: unknown;
  await act(async () => {
    received = await result.current.submit(values).catch((caught: unknown) => caught);
    expect(received).toMatchObject({
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
  });
  expect(onError).toHaveBeenCalledWith(received, expect.anything(), undefined, expect.anything());
  expect(onError.mock.calls[0][0]).toBe(received);
  expect(client.getQueryState(albumQueryKeys.adminList())?.isInvalidated).toBe(false);
});
