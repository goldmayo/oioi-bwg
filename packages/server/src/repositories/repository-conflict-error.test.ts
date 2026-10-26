import { DrizzleQueryError } from "drizzle-orm/errors";
import { describe, expect, it, vi } from "vitest";

import { insertAlbum, removeAlbum, updateAlbum } from "./album-repository";
import { insertPasswordCredential, insertProfile } from "./auth-repository";
import {
  AlbumSlugConflictError,
  CheerGuideReferenceError,
  PasswordCredentialEmailConflictError,
  ProfileNicknameConflictError,
  SongSlugConflictError,
} from "./repository-error";
import { insertSong, removeSong, updateSongWithSlugPolicy } from "./song-repository";

function uniqueViolation(constraintName: string) {
  const cause = Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint_name: constraintName,
  });
  return new DrizzleQueryError("insert into table values ($1)", ["PRIVATE_VALUE"], cause);
}

function insertReturningExecutor(error: unknown) {
  const returning = vi.fn().mockRejectedValue(error);
  const values = vi.fn(() => ({ returning }));
  return { insert: vi.fn(() => ({ values })) } as never;
}

function insertExecutor(error: unknown) {
  const values = vi.fn().mockRejectedValue(error);
  return { insert: vi.fn(() => ({ values })) } as never;
}

function updateReturningExecutor(error: unknown) {
  const returning = vi.fn().mockRejectedValue(error);
  const where = vi.fn(() => ({ returning }));
  const set = vi.fn(() => ({ where }));
  return { update: vi.fn(() => ({ set })) } as never;
}

const albumInput = {
  color: "#000000",
  imgUrl: "https://example.invalid/album.webp",
  isVisible: true,
  name: "Album",
  releaseDate: null,
  slug: "album",
};

const songInput = {
  albumId: "019a0170-0000-7000-8000-000000000001",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 1,
  slug: "song",
  title: "Song",
  youtubeId: "abcdefghijk",
};

const credentialInput = {
  accountId: "019a0170-0000-7000-8000-000000000001",
  email: "user@example.com",
  emailVerifiedAt: "2026-09-09T00:00:00.000Z",
  passwordChangedAt: "2026-09-09T00:00:00.000Z",
  passwordHash: "hash",
};

describe("repository unique conflict translation", () => {
  it.each([
    {
      expected: AlbumSlugConflictError,
      invoke: (error: unknown) => insertAlbum(insertReturningExecutor(error), albumInput),
      name: "album insert",
      physicalConstraint: "album_slug_key",
    },
    {
      expected: AlbumSlugConflictError,
      invoke: (error: unknown) =>
        updateAlbum(
          updateReturningExecutor(error),
          "019a0170-0000-7000-8000-000000000001",
          albumInput,
        ),
      name: "album update",
      physicalConstraint: "album_slug_key",
    },
    {
      expected: SongSlugConflictError,
      invoke: (error: unknown) => insertSong(insertReturningExecutor(error), songInput),
      name: "song insert",
      physicalConstraint: "song_slug_key",
    },
    {
      expected: SongSlugConflictError,
      invoke: (error: unknown) =>
        updateSongWithSlugPolicy(
          updateReturningExecutor(error),
          "019a0170-0000-7000-8000-000000000001",
          "song",
          songInput,
        ),
      name: "song slug update",
      physicalConstraint: "song_slug_key",
    },
    {
      expected: ProfileNicknameConflictError,
      invoke: (error: unknown) =>
        insertProfile(insertExecutor(error), "019a0170-0000-7000-8000-000000000001", "nickname"),
      name: "profile insert",
      physicalConstraint: "profile_nickname_key",
    },
    {
      expected: PasswordCredentialEmailConflictError,
      invoke: (error: unknown) => insertPasswordCredential(insertExecutor(error), credentialInput),
      name: "password credential insert",
      physicalConstraint: "password_credential_email_key",
    },
  ])("maps the exact $name constraint to its semantic error", async (testCase) => {
    await expect(
      testCase.invoke(uniqueViolation(testCase.physicalConstraint)),
    ).rejects.toBeInstanceOf(testCase.expected);
  });

  it.each([
    (error: unknown) => insertAlbum(insertReturningExecutor(error), albumInput),
    (error: unknown) =>
      updateAlbum(
        updateReturningExecutor(error),
        "019a0170-0000-7000-8000-000000000001",
        albumInput,
      ),
    (error: unknown) => insertSong(insertReturningExecutor(error), songInput),
    (error: unknown) =>
      updateSongWithSlugPolicy(
        updateReturningExecutor(error),
        "019a0170-0000-7000-8000-000000000001",
        "song",
        songInput,
      ),
    (error: unknown) =>
      insertProfile(insertExecutor(error), "019a0170-0000-7000-8000-000000000001", "nickname"),
    (error: unknown) => insertPasswordCredential(insertExecutor(error), credentialInput),
  ])("preserves an unknown unique constraint by identity", async (invoke) => {
    const error = uniqueViolation("unknown_constraint_key");

    await expect(invoke(error)).rejects.toBe(error);
  });

  it("preserves an unrelated database error by identity", async () => {
    const error = new Error("connection failed");

    await expect(insertAlbum(insertReturningExecutor(error), albumInput)).rejects.toBe(error);
  });
});

function deleteReturningExecutor(error: unknown) {
  const returning = vi.fn().mockRejectedValue(error);
  const where = vi.fn(() => ({ returning }));
  return { delete: vi.fn(() => ({ where })) } as never;
}

it.each([removeSong, removeAlbum])(
  "Domain §8.0 translates only the guide FK on deletion",
  async (remove) => {
    const constraint = "cheer_guide_song_id_fkey";
    const known = new DrizzleQueryError(
      "delete",
      [],
      Object.assign(new Error("referenced"), {
        code: "23503",
        constraint_name: constraint,
      }),
    );
    await expect(remove(deleteReturningExecutor(known), songInput.albumId)).rejects.toBeInstanceOf(
      CheerGuideReferenceError,
    );
    const unknown = new DrizzleQueryError(
      "delete",
      [],
      Object.assign(new Error("other FK"), {
        code: "23503",
        constraint_name: "another_fkey",
      }),
    );
    for (const error of [unknown, uniqueViolation(constraint), new Error("connection lost")]) {
      await expect(remove(deleteReturningExecutor(error), songInput.albumId)).rejects.toBe(error);
    }
  },
);
