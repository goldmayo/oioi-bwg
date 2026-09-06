import { DrizzleQueryError } from "drizzle-orm/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { adminSongListSchema } from "@/shared/contracts/song";

import { AppError } from "../errors/app-error";

const insertSong = vi.hoisted(() => vi.fn());
const findAdminSongBySlug = vi.hoisted(() => vi.fn());
const findSongBySlug = vi.hoisted(() => vi.fn());
const findSongSlugById = vi.hoisted(() => vi.fn());
const findSongsWithAlbum = vi.hoisted(() => vi.fn());
const updateSong = vi.hoisted(() => vi.fn());
const updateSongWithSlugPolicy = vi.hoisted(() => vi.fn());

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
  findSongSlugById,
  findSongsWithAlbum,
  findVisibleSongs: vi.fn(),
  insertSong,
  removeSong: vi.fn(),
  updateSong,
  updateSongWithSlugPolicy,
}));

import {
  createSong,
  editSong,
  getAdminSongEditorBySlug,
  getSongDetailBySlug,
  listAdminSongs,
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

function uniqueViolation(constraintName: string) {
  const cause = Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint_name: constraintName,
  });
  return new DrizzleQueryError("insert into Song values ($1)", ["PRIVATE_VALUE"], cause);
}

describe("song-service admin list DTO", () => {
  beforeEach(() => vi.clearAllMocks());

  it("preserves nullable normalization inside the domain list contract", async () => {
    findSongsWithAlbum.mockResolvedValue([
      {
        ...input,
        album: { name: "Test Album" },
        hasOfficialCheer: null,
        id: 2,
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
          id: 2,
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
        id: 2,
        slug: null,
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);

    await expect(listAdminSongs(context)).resolves.toMatchObject({
      items: [{ id: 2, slug: null }],
    });
  });
});

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
    updateSongWithSlugPolicy.mockResolvedValue([{ id: 2 }]);

    await editSong(context, 2, { ...input, lrcText: "" });

    expect(updateSongWithSlugPolicy).toHaveBeenCalledWith(
      expect.anything(),
      2,
      input.slug,
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

describe("song-service slug policy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps known create and update unique violations to a slug conflict", async () => {
    insertSong.mockRejectedValueOnce(uniqueViolation("Song_slug_key"));
    updateSongWithSlugPolicy.mockRejectedValueOnce(uniqueViolation("Song_slug_key"));

    await expect(
      createSong(context, { ...input, lrcText: "[00:01.00]가사" }),
    ).rejects.toMatchObject({ code: "SONG_SLUG_ALREADY_EXISTS" });
    await expect(editSong(context, 2, { ...input, slug: null, lrcText: "" })).rejects.toMatchObject(
      { code: "SONG_SLUG_ALREADY_EXISTS" },
    );
  });

  it("preserves an unknown unique violation as an unexpected error", async () => {
    const error = uniqueViolation("another_constraint_key");
    insertSong.mockRejectedValueOnce(error);

    const caught = await createSong(context, {
      ...input,
      lrcText: "[00:01.00]가사",
    }).catch((cause: unknown) => cause);

    expect(caught).toBe(error);
  });

  it("allows null retention, first assignment, and edits with the same slug", async () => {
    updateSongWithSlugPolicy.mockResolvedValue([{ id: 2 }]);

    await expect(editSong(context, 2, { ...input, slug: null, lrcText: "" })).resolves.toEqual({
      id: 2,
    });
    await expect(
      editSong(context, 2, { ...input, slug: "first-slug", lrcText: "" }),
    ).resolves.toEqual({ id: 2 });

    expect(updateSongWithSlugPolicy).toHaveBeenNthCalledWith(
      1,
      expect.anything(),
      2,
      null,
      expect.objectContaining({ albumId: input.albumId, title: input.title }),
    );
    expect(updateSongWithSlugPolicy).toHaveBeenNthCalledWith(
      2,
      expect.anything(),
      2,
      "first-slug",
      expect.objectContaining({ albumId: input.albumId, title: input.title }),
    );
  });

  it("distinguishes an immutable slug from a missing song", async () => {
    updateSongWithSlugPolicy.mockResolvedValue([]);
    findSongSlugById
      .mockResolvedValueOnce({ id: 2, slug: "original-slug" })
      .mockResolvedValueOnce(undefined);

    await expect(
      editSong(context, 2, { ...input, slug: "changed-slug", lrcText: "" }),
    ).rejects.toMatchObject({ code: "SONG_SLUG_IMMUTABLE" });
    await expect(
      editSong(context, 404, { ...input, slug: "missing-slug", lrcText: "" }),
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
