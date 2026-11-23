import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import { http as handlers, HttpResponse } from "msw";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { http } from "@/shared/api/http-client";
import { ApiError } from "@/shared/api/http-errors";

import { songQueryKeys } from "../index";

import {
  createAdminSong,
  deleteAdminSong,
  getAdminSongInformation,
  getAdminSongs,
  saveAdminSongLyrics,
  updateAdminSong,
} from "./api";
import { songQueries } from "./index";

const server = createHttpTestServer(window.location.href);
beforeEach(() => {
  vi.spyOn(http, "get");
  vi.spyOn(http, "post");
  vi.spyOn(http, "patch");
  vi.spyOn(http, "delete");
});

const song = {
  id: "019a0170-0000-7000-8000-000000000002",
  albumId: "019a0170-0000-7000-8000-000000000001",
  title: "Test Song",
  slug: "test-song",
  youtubeId: "youtube-id",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 1,
  updatedAt: "2026-01-01T00:00:00.000Z",
  album: { name: "Test Album" },
};
const input = {
  albumId: song.albumId,
  title: song.title,
  slug: song.slug,
  youtubeId: song.youtubeId,
  hasOfficialCheer: song.hasOfficialCheer,
  isTitle: song.isTitle,
  isVisible: song.isVisible,
  order: song.order,
  lrcText: "[00:01.00]가사",
};

describe("song browser API", () => {
  it("shares entity query keys across server and client consumers", () => {
    expect(songQueryKeys.detail("test-song")).toEqual(["song", "detail", "test-song"]);
    expect(songQueryKeys.adminList()).toEqual(["song", "list", "admin"]);
    expect(songQueries.adminList().queryKey).toEqual(songQueryKeys.adminList());
  });

  it("validates the admin song list response", async () => {
    const controller = new AbortController();
    const list = { items: [song], nextCursor: null };
    server.use(handlers.get("*/api/admin/songs", () => HttpResponse.json(list)));

    await expect(getAdminSongs(controller.signal)).resolves.toEqual(list);
    expect(http.get).toHaveBeenCalledWith("/api/admin/songs", { signal: controller.signal });
  });

  it("uses a separate UUID information key, forwards cancellation and validates the response", async () => {
    const signal = new AbortController().signal;
    const data = { ...song, hasLyrics: true, cheerGuides: [] };
    server.use(
      handlers.get("*/api/admin/songs/:id", () => HttpResponse.json(data), { once: true }),
      handlers.get("*/api/admin/songs/:id", () => HttpResponse.json(song)),
    );
    expect(songQueries.adminInformation(song.id).queryKey).toEqual(
      songQueryKeys.adminInformation(song.id),
    );
    expect(songQueryKeys.adminInformation(song.id)).not.toEqual(songQueryKeys.detail(song.id));
    await expect(getAdminSongInformation(song.id, signal)).resolves.toEqual(data);
    expect(http.get).toHaveBeenCalledWith(`/api/admin/songs/${song.id}`, { signal });
    await expect(getAdminSongInformation(song.id)).rejects.toThrow(
      "API response contract violation",
    );
  });

  it("rejects an invalid response contract", async () => {
    server.use(
      handlers.get("*/api/admin/songs", () => HttpResponse.json([song]), { once: true }),
      handlers.get("*/api/admin/songs", () =>
        HttpResponse.json({ items: [{ ...song, id: 1 }], nextCursor: null }),
      ),
    );
    await expect(getAdminSongs()).rejects.toThrow("API response contract violation");
    await expect(getAdminSongs()).rejects.toThrow("API response contract violation");
  });

  it("uses the admin mutation endpoints", async () => {
    const bodies: unknown[] = [];
    const save = async ({ request }: { request: Request }) => {
      bodies.push(await request.json());
      return HttpResponse.json({ id: song.id });
    };
    server.use(
      handlers.post("*/api/admin/songs", save),
      handlers.patch("*/api/admin/songs/:id", save),
      handlers.patch("*/api/admin/songs/:id/lyrics", save),
      handlers.delete("*/api/admin/songs/:id", () => new HttpResponse(null, { status: 204 })),
    );

    await expect(createAdminSong(input)).resolves.toEqual({ id: song.id });
    await expect(updateAdminSong(song.id, input)).resolves.toEqual({ id: song.id });
    await expect(deleteAdminSong(song.id)).resolves.toBeUndefined();
    await expect(
      saveAdminSongLyrics(song.id, { lyrics: [], youtubeId: input.youtubeId }),
    ).resolves.toEqual({ id: song.id });
    expect(bodies).toEqual([input, input, { lyrics: [], youtubeId: input.youtubeId }]);
    expect(http.post).toHaveBeenCalledWith("/api/admin/songs", { json: input });
    expect(http.patch).toHaveBeenCalledWith(
      "/api/admin/songs/019a0170-0000-7000-8000-000000000002",
      { json: input },
    );
    expect(http.delete).toHaveBeenCalledWith(
      "/api/admin/songs/019a0170-0000-7000-8000-000000000002",
    );
    expect(http.patch).toHaveBeenCalledWith(
      "/api/admin/songs/019a0170-0000-7000-8000-000000000002/lyrics",
      {
        json: { lyrics: [], youtubeId: input.youtubeId },
      },
    );
  });
});

it("권한 거부 HTTP 응답을 ApiError로 전달한다", async () => {
  server.use(
    handlers.get("*/api/admin/songs", () =>
      HttpResponse.json({ code: "FORBIDDEN", message: "접근 권한이 없습니다." }, { status: 403 }),
    ),
  );
  const result = getAdminSongs();
  await expect(result).rejects.toBeInstanceOf(ApiError);
  await expect(result).rejects.toMatchObject({ status: 403, code: "FORBIDDEN" });
});
