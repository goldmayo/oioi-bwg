import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/errors/app-error";

import { apiErrorResponseSchema } from "@/shared/contracts/error";
import { adminSongSummarySchema } from "@/shared/contracts/song";

const getRequestContext = vi.hoisted(() => vi.fn());
const createSong = vi.hoisted(() => vi.fn());
const listAdminSongs = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/request-context", () => ({ getRequestContext }));
vi.mock("@/server/services/song-service", () => ({ createSong, listAdminSongs }));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { GET, POST } from "./route";

const context = { ability: {}, user: { id: "1" } };
const input = {
  albumId: 1,
  title: "Test Song",
  slug: "test-song",
  youtubeId: "youtube-id",
  hasOfficialCheer: true,
  isTitle: true,
  isVisible: true,
  order: 1,
  lrcText: "[00:01.00]가사",
};
const song = {
  ...input,
  id: 2,
  lrcText: undefined,
  updatedAt: "2026-01-01T00:00:00.000Z",
  album: { name: "Test Album" },
};

describe("/api/admin/songs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getRequestContext.mockResolvedValue(context);
  });

  it("returns the protected admin song list", async () => {
    listAdminSongs.mockResolvedValue([song]);

    const response = await GET();

    expect(response.status).toBe(200);
    expect(adminSongSummarySchema.array().parse(await response.json())).toEqual([song]);
    expect(listAdminSongs).toHaveBeenCalledWith(context);
  });

  it("creates a song with a validated LRC contract", async () => {
    createSong.mockResolvedValue({ id: 2 });

    const response = await POST(
      new Request("https://example.test/api/admin/songs", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ id: 2 });
    expect(createSong).toHaveBeenCalledWith(context, input);
  });

  it("maps authorization and request validation failures", async () => {
    listAdminSongs.mockRejectedValue(new AppError("UNAUTHENTICATED"));
    expect((await GET()).status).toBe(401);

    const response = await POST(
      new Request("https://example.test/api/admin/songs", {
        body: JSON.stringify({ ...input, lrcText: "" }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );

    expect(response.status).toBe(400);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe("VALIDATION_ERROR");
  });
});
