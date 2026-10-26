import { adminSongListSchema } from "@oioi-bwg/contracts/song";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors/app-error";
import { SongSlugConflictError, CheerGuideReferenceError } from "../repositories/repository-error";

const removeSong = vi.hoisted(() => vi.fn());
const insertSong = vi.hoisted(() => vi.fn());
const findVisibleSongs = vi.hoisted(() => vi.fn());
const findAdminSongBySlug = vi.hoisted(() => vi.fn());
const findSongBySlug = vi.hoisted(() => vi.fn());
const findSongsWithAlbum = vi.hoisted(() => vi.fn());
const updateSong = vi.hoisted(() => vi.fn());
const updateSongWithSlugPolicy = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("../auth/request-context", () => ({
  requireUser: (ctx: { user: unknown }) => {
    if (!ctx.user) throw new AppError("UNAUTHENTICATED");
  },
}));
const lockSongForGuideWrite = vi.hoisted(() => vi.fn());
const writeLegacyGuide = vi.hoisted(() => vi.fn());
vi.mock("../db", () => ({
  getDatabase: () => ({ transaction: (work: (tx: object) => unknown) => work({}) }),
}));
vi.mock("../repositories/cheer-guide-repository", () => ({ lockSongForGuideWrite }));
vi.mock("./cheer-guide-write-service", () => ({ writeLegacyGuide }));
beforeEach(() => {
  lockSongForGuideWrite.mockResolvedValue({ id: "019a0170-0000-7000-8000-000000000002" });
  writeLegacyGuide.mockResolvedValue(undefined);
});
vi.mock("../repositories/song-repository", () => ({
  findAdminSongBySlug,
  findSongBySlug,
  findSongsWithAlbum,
  findVisibleSongs,
  insertSong,
  removeSong,
  updateSong,
  updateSongWithSlugPolicy,
}));

import {
  createSong,
  deleteSong,
  editSong,
  getAdminSongEditorBySlug,
  getSongDetailBySlug,
  listAdminSongs,
  listVisibleSongsForSitemap,
  saveSongLyrics,
} from "./song-service";

const context = {
  user: { id: "019a0170-0000-7000-8000-000000000001" },
  ability: { cannot: () => false },
} as never;
const input = {
  albumId: "019a0170-0000-7000-8000-000000000001",
  title: "Test Song",
  slug: "test-song",
  youtubeId: "youtube-id",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 1,
};

describe("song-service admin list DTO", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves nullable normalization inside the domain list contract", async () => {
    findSongsWithAlbum.mockResolvedValue([
      {
        ...input,
        album: { name: "Test Album" },
        hasOfficialCheer: null,
        id: "019a0170-0000-7000-8000-000000000002",
        order: null,
        updatedAt: null,
      },
    ]);

    const result = await listAdminSongs(context);

    expect(adminSongListSchema.parse(result)).toEqual({
      items: [
        {
          ...input,
          album: { name: "Test Album" },
          hasOfficialCheer: false,
          id: "019a0170-0000-7000-8000-000000000002",
          order: 0,
          updatedAt: "",
        },
      ],
      nextCursor: null,
    });
  });

  it("preserves a legacy null slug in the admin contract", async () => {
    findSongsWithAlbum.mockResolvedValue([
      {
        ...input,
        album: { name: "Test Album" },
        id: "019a0170-0000-7000-8000-000000000002",
        slug: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await expect(listAdminSongs(context)).resolves.toMatchObject({
      items: [{ id: "019a0170-0000-7000-8000-000000000002", slug: null }],
    });
  });
});

describe("song-service LRC boundary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("parses LRC before creating a song", async () => {
    insertSong.mockResolvedValue([{ id: "019a0170-0000-7000-8000-000000000002" }]);

    await expect(createSong(context, { ...input, lrcText: "[00:01.00]가사" })).resolves.toEqual({
      id: "019a0170-0000-7000-8000-000000000002",
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
    updateSongWithSlugPolicy.mockResolvedValue([{ id: "019a0170-0000-7000-8000-000000000002" }]);

    await editSong(context, "019a0170-0000-7000-8000-000000000002", { ...input, lrcText: "" });

    expect(updateSongWithSlugPolicy).toHaveBeenCalledWith(
      expect.anything(),
      "019a0170-0000-7000-8000-000000000002",
      input.slug,
      expect.not.objectContaining({ lyrics: expect.anything() }),
    );
  });

  it("rejects saving lyrics for a missing song", async () => {
    updateSong.mockResolvedValue([]);

    await expect(
      saveSongLyrics(context, "019a0170-0000-7000-8000-000000000194", {
        lyrics: [],
        youtubeId: "youtube-id",
      }),
    ).rejects.toMatchObject({ code: "SONG_NOT_FOUND" });
  });
});

describe("song-service slug policy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps create and update repository slug conflicts to the song AppError", async () => {
    insertSong.mockRejectedValueOnce(new SongSlugConflictError());
    updateSongWithSlugPolicy.mockRejectedValueOnce(new SongSlugConflictError());

    await expect(
      createSong(context, { ...input, lrcText: "[00:01.00]가사" }),
    ).rejects.toMatchObject({ code: "SONG_SLUG_ALREADY_EXISTS" });
    await expect(
      editSong(context, "019a0170-0000-7000-8000-000000000002", {
        ...input,
        slug: null,
        lrcText: "",
      }),
    ).rejects.toMatchObject({ code: "SONG_SLUG_ALREADY_EXISTS" });
  });

  it("preserves an unrelated repository failure as an unexpected error", async () => {
    const error = new Error("unexpected repository failure");
    insertSong.mockRejectedValueOnce(error);

    const caught = await createSong(context, {
      ...input,
      lrcText: "[00:01.00]가사",
    }).catch((cause: unknown) => cause);

    expect(caught).toBe(error);
  });

  it("allows null retention, first assignment, and edits with the same slug", async () => {
    updateSongWithSlugPolicy.mockResolvedValue([{ id: "019a0170-0000-7000-8000-000000000002" }]);

    await expect(
      editSong(context, "019a0170-0000-7000-8000-000000000002", {
        ...input,
        slug: null,
        lrcText: "",
      }),
    ).resolves.toEqual({
      id: "019a0170-0000-7000-8000-000000000002",
    });
    await expect(
      editSong(context, "019a0170-0000-7000-8000-000000000002", {
        ...input,
        slug: "first-slug",
        lrcText: "",
      }),
    ).resolves.toEqual({ id: "019a0170-0000-7000-8000-000000000002" });

    expect(updateSongWithSlugPolicy).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      "019a0170-0000-7000-8000-000000000002",
      null,
      expect.objectContaining({ albumId: input.albumId, title: input.title }),
    );
    expect(updateSongWithSlugPolicy).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      "019a0170-0000-7000-8000-000000000002",
      "first-slug",
      expect.objectContaining({ albumId: input.albumId, title: input.title }),
    );
  });

  it("distinguishes an immutable slug from a missing song", async () => {
    updateSongWithSlugPolicy.mockResolvedValue([]);
    lockSongForGuideWrite
      .mockResolvedValueOnce({ id: "019a0170-0000-7000-8000-000000000002", slug: "original-slug" })
      .mockResolvedValueOnce(undefined);

    await expect(
      editSong(context, "019a0170-0000-7000-8000-000000000002", {
        ...input,
        slug: "changed-slug",
        lrcText: "",
      }),
    ).rejects.toMatchObject({ code: "SONG_SLUG_IMMUTABLE" });
    await expect(
      editSong(context, "019a0170-0000-7000-8000-000000000194", {
        ...input,
        slug: "missing-slug",
        lrcText: "",
      }),
    ).rejects.toMatchObject({ code: "SONG_NOT_FOUND" });
  });
});

describe("song-service public DTO boundary", () => {
  const row = {
    id: "019a0170-0000-7000-8000-000000000002",
    albumId: "019a0170-0000-7000-8000-000000000001",
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
      id: "019a0170-0000-7000-8000-000000000001",
      name: "Test Album",
      slug: "test-album",
      imgUrl: "https://assets.oioibawige.com/test.webp",
      color: "#000000",
      releaseDate: null,
      isVisible: true,
      createdAt: "2026-01-01T00:00:00.000Z",
      songs: [
        {
          id: "019a0170-0000-7000-8000-000000000002",
          albumId: "019a0170-0000-7000-8000-000000000001",
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
          id: "019a0170-0000-7000-8000-000000000003",
          albumId: "019a0170-0000-7000-8000-000000000001",
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
      id: "019a0170-0000-7000-8000-000000000002",
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
        id: "019a0170-0000-7000-8000-000000000001",
        name: "Test Album",
        slug: "test-album",
        imgUrl: "https://assets.oioibawige.com/test.webp",
        color: "#000000",
        releaseDate: null,
        isVisible: true,
        createdAt: "2026-01-01T00:00:00.000Z",
        songs: [
          {
            id: "019a0170-0000-7000-8000-000000000002",
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
      id: "019a0170-0000-7000-8000-000000000002",
      title: "Test Song",
      youtubeId: "youtube-id",
      lyrics: [{ startTime: 1, segments: [{ text: "가사" }] }],
    });

    await expect(getAdminSongEditorBySlug(context, "test-song")).resolves.toEqual({
      id: "019a0170-0000-7000-8000-000000000002",
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

describe("song-service sitemap public visibility", () => {
  const visible = {
    id: "019a0170-0000-7000-8000-000000000007",
    title: "Public song",
    slug: "public-song",
    youtubeId: "abcdefghijk",
    updatedAt: "2026-10-25T01:00:00Z",
    album: { isVisible: true },
  };

  it("excludes hidden-parent and unrenderable songs and exposes only sitemap fields", async () => {
    findVisibleSongs.mockResolvedValue([
      visible,
      { ...visible, slug: "hidden-parent", album: { isVisible: false } },
      { ...visible, slug: "missing-video", youtubeId: null },
      { ...visible, slug: "missing-title", title: null },
      { ...visible, slug: null },
    ]);
    await expect(listVisibleSongsForSitemap()).resolves.toEqual([
      { slug: visible.slug, updatedAt: visible.updatedAt },
    ]);
  });

  it("keeps a renderable song even when its legacy modification date is absent", async () => {
    findVisibleSongs.mockResolvedValue([{ ...visible, updatedAt: null }]);
    await expect(listVisibleSongsForSitemap()).resolves.toEqual([
      { slug: visible.slug, updatedAt: null },
    ]);
  });
});

it("Domain §8.0 maps referenced song deletion and preserves unexpected failures", async () => {
  removeSong.mockRejectedValueOnce(new CheerGuideReferenceError());
  await expect(deleteSong(context, "019a0170-0000-7000-8000-000000000001")).rejects.toMatchObject({
    code: "CONTENT_HAS_CHEER_GUIDE",
  });
  const error = new Error("unexpected persistence failure");
  removeSong.mockRejectedValueOnce(error);
  await expect(deleteSong(context, "019a0170-0000-7000-8000-000000000001")).rejects.toBe(error);
  removeSong.mockResolvedValueOnce([]);
  await expect(deleteSong(context, "019a0170-0000-7000-8000-000000000001")).rejects.toMatchObject({
    code: "SONG_NOT_FOUND",
  });
});
