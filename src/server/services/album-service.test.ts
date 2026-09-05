import { DrizzleQueryError } from "drizzle-orm/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../errors/app-error";
import { toErrorResponse } from "../http/api-response";

const insertAlbum = vi.hoisted(() => vi.fn());
const updateAlbum = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("../auth/request-context", () => ({
  requireUser: (ctx: { user: unknown }) => {
    if (!ctx.user) throw new AppError("UNAUTHENTICATED");
  },
}));
vi.mock("../db", () => ({ getDatabase: () => ({}) }));
vi.mock("../observability/server-logger", () => ({ reportServerError: vi.fn() }));
vi.mock("../repositories/album-repository", () => ({
  findAlbumBySlug: vi.fn(),
  findAllAlbums: vi.fn(),
  findVisibleAlbumsWithSongs: vi.fn(),
  insertAlbum,
  removeAlbum: vi.fn(),
  updateAlbum,
}));

import { createAlbum, editAlbum } from "./album-service";

const context = {
  user: { id: "1" },
  ability: { cannot: () => false },
} as never;
const input = {
  color: "#000000",
  imgUrl: "https://assets.oioibawige.com/images/albums/test.webp",
  isVisible: true,
  name: "Test Album",
  releaseDate: null,
  slug: "test-album",
};

function uniqueViolation(constraintName: string) {
  const cause = Object.assign(new Error("duplicate key"), {
    code: "23505",
    constraint_name: constraintName,
  });
  return new DrizzleQueryError("insert into Album values ($1)", ["PRIVATE_VALUE"], cause);
}

describe("album-service unique conflicts", () => {
  beforeEach(() => vi.clearAllMocks());

  it("maps create and edit slug violations to the album conflict", async () => {
    insertAlbum.mockRejectedValueOnce(uniqueViolation("Album_slug_key"));
    updateAlbum.mockRejectedValueOnce(uniqueViolation("Album_slug_key"));

    await expect(createAlbum(context, input)).rejects.toMatchObject({
      code: "ALBUM_SLUG_ALREADY_EXISTS",
    });
    await expect(editAlbum(context, 1, input)).rejects.toMatchObject({
      code: "ALBUM_SLUG_ALREADY_EXISTS",
    });
  });

  it("preserves an unknown unique violation as an unexpected error", async () => {
    const error = uniqueViolation("another_constraint_key");
    insertAlbum.mockRejectedValueOnce(error);

    const caught = await createAlbum(context, input).catch((cause: unknown) => cause);

    expect(caught).toBe(error);
    expect(toErrorResponse(caught).status).toBe(500);
  });
});
