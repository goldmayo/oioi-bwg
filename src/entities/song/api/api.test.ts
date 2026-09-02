import { afterEach, describe, expect, it, vi } from "vitest";

const http = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));

vi.mock("@/shared/api/http-client", () => ({ http }));

import { songQueryKeys } from "@/shared/contracts/song";

import {
  createAdminSong,
  deleteAdminSong,
  getAdminSongs,
  saveAdminSongLyrics,
  updateAdminSong,
} from "./api";
import { songQueries } from "./queries";

const song = {
  id: 2,
  albumId: 1,
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

afterEach(() => vi.clearAllMocks());

describe("song browser API", () => {
  it("shares entity query keys across server and client consumers", () => {
    expect(songQueryKeys.detail("test-song").queryKey).toEqual(["song", "detail", "test-song"]);
    expect(songQueryKeys.adminList.queryKey).toEqual(["song", "adminList"]);
    expect(songQueries.adminList().queryKey).toEqual(songQueryKeys.adminList.queryKey);
  });

  it("validates the admin song list response", async () => {
    const controller = new AbortController();
    http.get.mockResolvedValue([song]);

    await expect(getAdminSongs(controller.signal)).resolves.toEqual([song]);
    expect(http.get).toHaveBeenCalledWith("/api/admin/songs", { signal: controller.signal });
  });

  it("rejects an invalid response contract", async () => {
    http.get.mockResolvedValue([{ ...song, id: "2" }]);
    await expect(getAdminSongs()).rejects.toThrow("API response contract violation");
  });

  it("uses the admin mutation endpoints", async () => {
    http.post.mockResolvedValue({ id: song.id });
    http.patch.mockResolvedValue({ id: song.id });
    http.delete.mockResolvedValue(undefined);

    await expect(createAdminSong(input)).resolves.toEqual({ id: song.id });
    await expect(updateAdminSong(song.id, input)).resolves.toEqual({ id: song.id });
    await expect(deleteAdminSong(song.id)).resolves.toBeUndefined();
    await expect(
      saveAdminSongLyrics(song.id, { lyrics: [], youtubeId: input.youtubeId }),
    ).resolves.toEqual({ id: song.id });
    expect(http.post).toHaveBeenCalledWith("/api/admin/songs", { json: input });
    expect(http.patch).toHaveBeenCalledWith("/api/admin/songs/2", { json: input });
    expect(http.delete).toHaveBeenCalledWith("/api/admin/songs/2");
    expect(http.patch).toHaveBeenCalledWith("/api/admin/songs/2/lyrics", {
      json: { lyrics: [], youtubeId: input.youtubeId },
    });
  });
});
