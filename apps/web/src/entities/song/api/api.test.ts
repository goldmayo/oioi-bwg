import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import type { SongDetail } from "@oioi-bwg/contracts/song";
import { http, HttpResponse } from "msw";
import { expect, test, vi } from "vitest";

import { ApiError, ClientContractError, ClientTransportError } from "@/shared/api/http-errors";

import { songQueryKeys } from "../index";

import { getSongDetail } from "./api";
import { songQueries } from "./index";

const server = createHttpTestServer(window.location.href);
const endpoint = `${window.location.origin}/api/songs/:slug`;
const song: SongDetail = {
  id: "019a0170-0000-7000-8000-000000000068",
  title: "Harmony",
  slug: "harmony",
  youtubeId: "abcdefghijk",
  lyrics: [],
  hasOfficialCheer: false,
  isTitle: true,
  order: 1,
  album: {
    id: "019a0170-0000-7000-8000-000000000001",
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

test("정상 곡 응답을 실제 HTTP client와 parser로 읽고 slug를 인코딩한다", async () => {
  const respond = vi.fn((_info: { request: Request }) => HttpResponse.json(song));
  server.use(http.get(endpoint, respond));

  await expect(getSongDetail("space / slug")).resolves.toEqual(song);
  expect(respond).toHaveBeenCalledOnce();
  expect(new URL(respond.mock.calls[0][0].request.url).pathname).toBe(
    "/api/songs/space%20%2F%20slug",
  );
});

test("깨진 성공 payload는 ClientContractError로 거부한다", async () => {
  server.use(http.get(endpoint, () => HttpResponse.json({ invalid: true })));

  const result = getSongDetail("harmony");
  await expect(result).rejects.toThrow(ClientContractError);
  await expect(result).rejects.toThrow("API response contract violation");
});

test("곡 없음 응답을 상태와 메시지가 보존된 ApiError로 정규화한다", async () => {
  server.use(
    http.get(endpoint, () =>
      HttpResponse.json(
        { code: "SONG_NOT_FOUND", message: "곡을 찾을 수 없습니다." },
        { status: 404 },
      ),
    ),
  );

  const result = getSongDetail("missing");
  await expect(result).rejects.toBeInstanceOf(ApiError);
  await expect(result).rejects.toMatchObject({
    status: 404,
    code: "SONG_NOT_FOUND",
    message: "곡을 찾을 수 없습니다.",
  });
});

test("실패 계약 밖의 HTTP 응답은 ClientTransportError로 구분하고 재시도하지 않는다", async () => {
  const respond = vi.fn(() => new HttpResponse("not-json", { status: 502 }));
  server.use(http.get(endpoint, respond));

  const result = getSongDetail("harmony");
  await expect(result).rejects.toBeInstanceOf(ClientTransportError);
  await expect(result).rejects.toMatchObject({ code: "HTTP_ERROR", status: 502 });
  expect(respond).toHaveBeenCalledOnce();
});

test("호출자의 signal로 진행 중인 HTTP 요청을 취소한다", async () => {
  const controller = new AbortController();
  const started = Promise.withResolvers<AbortSignal>();
  const response = Promise.withResolvers<Response>();
  server.use(
    http.get(endpoint, ({ request }) => {
      started.resolve(request.signal);
      return response.promise;
    }),
  );

  const result = getSongDetail("harmony", controller.signal);
  const rejected = expect(result).rejects.toMatchObject({ name: "AbortError" });
  try {
    const requestSignal = await started.promise;
    controller.abort();
    await rejected;
    expect(requestSignal.aborted).toBe(true);
  } finally {
    response.resolve(HttpResponse.json(song));
  }
});

test("곡 query는 공유 query key와 같은 식별자를 사용한다", () => {
  expect(songQueries.detail("fixture").queryKey).toEqual(songQueryKeys.detail("fixture"));
});
