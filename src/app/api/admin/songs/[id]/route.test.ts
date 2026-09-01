import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { apiErrorResponseSchema } from "@/shared/contracts/error";

const getRequestContext = vi.hoisted(() => vi.fn());
const deleteSong = vi.hoisted(() => vi.fn());
const editSong = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/request-context", () => ({ getRequestContext }));
vi.mock("@/server/services/song-service", () => ({ deleteSong, editSong }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { DELETE, PATCH } from "./route";

const context = { ability: {}, user: { id: "1" } };
const routeContext = { params: Promise.resolve({ id: "2" }) };
const input = {
  albumId: 1,
  title: "Updated Song",
  slug: "updated-song",
  youtubeId: "youtube-id",
  hasOfficialCheer: false,
  isTitle: false,
  isVisible: true,
  order: 2,
  lrcText: "",
};

describe("/api/admin/songs/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestContext.mockResolvedValue(context);
  });

  it("updates a song with validated path and body contracts", async () => {
    editSong.mockResolvedValue({ id: 2 });

    const response = await PATCH(
      new Request("https://example.test/api/admin/songs/2", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 2 });
    expect(editSong).toHaveBeenCalledWith(context, 2, input);
  });

  it("returns 204 after deleting a song", async () => {
    deleteSong.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("https://example.test/api/admin/songs/2", { method: "DELETE" }),
      routeContext,
    );

    expect(response.status).toBe(204);
    expect(deleteSong).toHaveBeenCalledWith(context, 2);
  });

  it("maps a missing song and an invalid path", async () => {
    deleteSong.mockRejectedValue(new AppError("SONG_NOT_FOUND"));
    const missing = await DELETE(
      new Request("https://example.test/api/admin/songs/2", { method: "DELETE" }),
      routeContext,
    );
    expect(missing.status).toBe(404);
    expect(apiErrorResponseSchema.parse(await missing.json()).code).toBe("SONG_NOT_FOUND");

    const invalid = await DELETE(
      new Request("https://example.test/api/admin/songs/nope", { method: "DELETE" }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(invalid.status).toBe(400);
  });
});
