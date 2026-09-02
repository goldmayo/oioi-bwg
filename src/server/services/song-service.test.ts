import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors/app-error";

const insertSong = vi.hoisted(() => vi.fn());
const findAdminSongBySlug = vi.hoisted(() => vi.fn());
const findSongBySlug = vi.hoisted(() => vi.fn());
const updateSong = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("../auth/request-context", () => ({
  requireUser: (ctx: { user: unknown }) => {
    if (!ctx.user) throw new AppError("UNAUTHENTICATED");
  },
}));
vi.mock("../db", () => ({ getDatabase: () => ({}) }));
vi.mock("../repositories/song-repository", () => ({
  findAdminSongBySlug,
  findSongBySlug,
  findSongsWithAlbum: vi.fn(),
  findVisibleSongs: vi.fn(),
  insertSong,
  removeSong: vi.fn(),
  updateSong,
}));

import {
  createSong,
  editSong,
  getAdminSongEditorBySlug,
  getSongDetailBySlug,
  saveSongLyrics,
} from "./song-service";

const context = {
  user: { id: "1" },
  ability: { cannot: () => false },
} as never;
const input = {
  albumId: 1,
  title: "Test Song",
  slug: "test-song",
  youtubeId: "youtube-id",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 1,
};

describe("song-service LRC boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses LRC before creating a song", async () => {
    insertSong.mockResolvedValue([{ id: 2 }]);

    await expect(createSong(context, { ...input, lrcText: "[00:01.00]가사" })).resolves.toEqual({
      id: 2,
    });
    expect(insertSong).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        lyrics: [
          {
            isExtra: false,
            segments: [{ isCheer: false, isEcho: false, text: "가사" }],
            startTime: 1,
          },
        ],
      }),
    );
  });

  it("rejects LRC without a valid lyric line", () => {
    expect(() => createSong(context, { ...input, lrcText: "invalid" })).toThrowError(
      new AppError("SONG_LYRICS_INVALID"),
    );
    expect(insertSong).not.toHaveBeenCalled();
  });

  it("preserves lyrics when an edit has an empty LRC input", async () => {
    updateSong.mockResolvedValue([{ id: 2 }]);

    await editSong(context, 2, { ...input, lrcText: "" });

    expect(updateSong).toHaveBeenCalledWith(
      expect.anything(),
      2,
      expect.not.objectContaining({ lyrics: expect.anything() }),
    );
  });

  it("rejects saving lyrics for a missing song", async () => {
    updateSong.mockResolvedValue([]);

    await expect(
      saveSongLyrics(context, 404, { lyrics: [], youtubeId: "youtube-id" }),
    ).rejects.toMatchObject({ code: "SONG_NOT_FOUND" });
  });
});

describe("song-service public DTO boundary", () => {
  const row = {
    id: 2,
    albumId: 1,
    title: "Test Song",
    slug: "test-song",
    youtubeId: "youtube-id",
    lyrics: [{ startTime: 1, segments: [{ text: "가사" }] }],
    hasOfficialCheer: null,
    isTitle: true,
    isVisible: true,
    order: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
    album: {
      id: 1,
      name: "Test Album",
      slug: "test-album",
      imgUrl: "https://assets.oioibawige.com/test.webp",
      color: "#000000",
      releaseDate: null,
      isVisible: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      songs: [
        {
          id: 2,
          albumId: 1,
          title: "Test Song",
          slug: "test-song",
          youtubeId: "youtube-id",
          lyrics: null,
          hasOfficialCheer: null,
          isTitle: true,
          isVisible: true,
          order: null,
          createdAt: null,
          updatedAt: null,
        },
        {
          id: 3,
          albumId: 1,
          title: "Hidden Song",
          slug: "hidden-song",
          youtubeId: "hidden-id",
          lyrics: null,
          hasOfficialCheer: false,
          isTitle: false,
          isVisible: false,
          order: 2,
          createdAt: null,
          updatedAt: null,
        },
      ],
    },
  };

  beforeEach(() => vi.clearAllMocks());

  it("maps persistence data to an allow-listed public DTO", async () => {
    findSongBySlug.mockResolvedValue(row);

    await expect(getSongDetailBySlug("test-song")).resolves.toEqual({
      id: 2,
      title: "Test Song",
      slug: "test-song",
      youtubeId: "youtube-id",
      lyrics: [
        {
          startTime: 1,
          segments: [{ text: "가사", isCheer: false, isEcho: false }],
          isExtra: false,
        },
      ],
      hasOfficialCheer: false,
      isTitle: true,
      order: 0,
      album: {
        id: 1,
        name: "Test Album",
        slug: "test-album",
        imgUrl: "https://assets.oioibawige.com/test.webp",
        color: "#000000",
        releaseDate: null,
        isVisible: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        songs: [
          {
            id: 2,
            title: "Test Song",
            slug: "test-song",
            youtubeId: "youtube-id",
            hasOfficialCheer: false,
            isTitle: true,
          },
        ],
      },
    });
  });

  it("normalizes nullable lyrics and hides songs whose album is not public", async () => {
    findSongBySlug.mockResolvedValue({ ...row, lyrics: null });
    await expect(getSongDetailBySlug("test-song")).resolves.toMatchObject({ lyrics: [] });

    findSongBySlug.mockResolvedValue({ ...row, album: { ...row.album, isVisible: false } });
    await expect(getSongDetailBySlug("test-song")).resolves.toBeUndefined();
  });

  it("treats malformed stored lyrics as an unexpected contract failure", async () => {
    findSongBySlug.mockResolvedValue({ ...row, lyrics: [{ invalid: true }] });

    await expect(getSongDetailBySlug("test-song")).rejects.toThrow(
      "Stored song lyrics contract violation",
    );
  });

  it("validates the admin editor snapshot at the service boundary", async () => {
    findAdminSongBySlug.mockResolvedValue({
      id: 2,
      title: "Test Song",
      youtubeId: "youtube-id",
      lyrics: [{ startTime: 1, segments: [{ text: "가사" }] }],
    });

    await expect(getAdminSongEditorBySlug(context, "test-song")).resolves.toEqual({
      id: 2,
      title: "Test Song",
      youtubeId: "youtube-id",
      lyrics: [
        {
          startTime: 1,
          segments: [{ text: "가사", isCheer: false, isEcho: false }],
          isExtra: false,
        },
      ],
    });
  });
});
