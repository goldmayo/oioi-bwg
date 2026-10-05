import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { apiErrorResponseSchema } from "@/shared/contracts/error";

const getRequestContext = vi.hoisted(() => vi.fn());
const saveSongLyrics = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/request-context", () => ({ getRequestContext }));
vi.mock("@/server/services/song-service", () => ({ saveSongLyrics }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { PATCH } from "./route";

const context = { ability: {}, user: { id: "1" } };
const routeContext = { params: Promise.resolve({ id: "2" }) };
const input = {
  lyrics: [
    {
      startTime: 1,
      segments: [{ text: "가사", isCheer: false, isEcho: false }],
      isExtra: false,
    },
  ],
  youtubeId: "youtube-id",
};

describe("/api/admin/songs/[id]/lyrics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestContext.mockResolvedValue(context);
  });

  it("saves validated structured lyrics", async () => {
    saveSongLyrics.mockResolvedValue({ id: 2 });

    const response = await PATCH(
      new Request("https://example.test/api/admin/songs/2/lyrics", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: 2 });
    expect(saveSongLyrics).toHaveBeenCalledWith(context, 2, input);
  });

  it("maps invalid input and a missing song", async () => {
    const invalid = await PATCH(
      new Request("https://example.test/api/admin/songs/2/lyrics", {
        body: JSON.stringify({ ...input, lyrics: [{ invalid: true }] }),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      routeContext,
    );
    expect(invalid.status).toBe(400);

    saveSongLyrics.mockRejectedValue(new AppError("SONG_NOT_FOUND"));
    const missing = await PATCH(
      new Request("https://example.test/api/admin/songs/2/lyrics", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "PATCH",
      }),
      routeContext,
    );
    expect(missing.status).toBe(404);
    expect(apiErrorResponseSchema.parse(await missing.json()).code).toBe("SONG_NOT_FOUND");
  });
});
