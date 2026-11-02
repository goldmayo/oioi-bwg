// @vitest-environment node

import { apiErrorResponseSchema } from "@oioi-bwg/contracts/error";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getRequestContext = vi.hoisted(() => vi.fn());
const deleteSong = vi.hoisted(() => vi.fn());
const editSong = vi.hoisted(() => vi.fn());
const getAdminSongInformation = vi.hoisted(() => vi.fn());

vi.mock("server-only", () => ({}));
vi.mock("@/server/auth/request-context", () => ({
  getRequestContext,
  getRequestAuthorization: async () => ({
    context: await getRequestContext(),
    decision: "unknown",
    rejectionLogged: false,
  }),
}));
vi.mock("@oioi-bwg/server/services/song-service", () => ({
  deleteSong,
  editSong,
  getAdminSongInformation,
}));
vi.mock("@/shared/lib/sentry", () => ({ logger: { error: vi.fn() } }));

import { DELETE, GET, PATCH } from "./route";

const context = { ability: {}, user: { id: "019a0170-0000-7000-8000-000000000001" } };
const routeContext = { params: Promise.resolve({ id: "019a0170-0000-7000-8000-000000000002" }) };
const input = {
  albumId: "019a0170-0000-7000-8000-000000000001",
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

  it("UUID로 숨김·null slug 정보를 조회하며 개인 응답을 캐시하지 않는다", async () => {
    const { lrcText: _lrcText, ...fields } = input;
    const information = {
      ...fields,
      id: "019a0170-0000-7000-8000-000000000002",
      slug: null,
      isVisible: false,
      album: { name: "앨범" },
      updatedAt: "",
      hasLyrics: false,
      cheerGuides: [],
    };
    getAdminSongInformation.mockResolvedValue(information);
    const response = await GET(
      new Request("https://example.test/api/admin/songs/id"),
      routeContext,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(information);
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
    expect(getAdminSongInformation).toHaveBeenCalledWith(context, information.id);
  });

  it.each([
    ["UNAUTHENTICATED", 401],
    ["FORBIDDEN", 403],
    ["SONG_NOT_FOUND", 404],
  ] as const)("조회 실패 %s를 HTTP %s로 변환한다", async (code, status) => {
    getAdminSongInformation.mockRejectedValue(new AppError(code));
    const response = await GET(
      new Request("https://example.test/api/admin/songs/id"),
      routeContext,
    );
    expect(response.status).toBe(status);
    expect(apiErrorResponseSchema.parse(await response.json()).code).toBe(code);
  });

  it("잘못된 UUID는 조회하지 않고 깨진 출력 계약은 500으로 처리한다", async () => {
    const request = new Request("https://example.test/api/admin/songs/id");
    const invalid = await GET(request, { params: Promise.resolve({ id: "invalid" }) });
    expect(invalid.status).toBe(400);
    expect(getAdminSongInformation).not.toHaveBeenCalled();
    getAdminSongInformation.mockResolvedValue({ id: "private", internal: "secret" });
    const broken = await GET(request, routeContext);
    expect(broken.status).toBe(500);
    expect(await broken.json()).toEqual({
      code: "INTERNAL_SERVER_ERROR",
      message: "서버 오류가 발생했습니다.",
    });
  });

  it("updates a song with validated path and body contracts", async () => {
    editSong.mockResolvedValue({ id: "019a0170-0000-7000-8000-000000000002" });

    const response = await PATCH(
      new Request("https://example.test/api/admin/songs/019a0170-0000-7000-8000-000000000002", {
        body: JSON.stringify(input),
        headers: { "content-type": "application/json", Origin: "http://127.0.0.1:3001" },
        method: "PATCH",
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ id: "019a0170-0000-7000-8000-000000000002" });
    expect(editSong).toHaveBeenCalledWith(context, "019a0170-0000-7000-8000-000000000002", input);
  });

  it("allows a legacy null slug to remain null", async () => {
    editSong.mockResolvedValue({ id: "019a0170-0000-7000-8000-000000000002" });
    const legacyInput = { ...input, slug: null };

    const response = await PATCH(
      new Request("https://example.test/api/admin/songs/019a0170-0000-7000-8000-000000000002", {
        body: JSON.stringify(legacyInput),
        headers: { "content-type": "application/json", Origin: "http://127.0.0.1:3001" },
        method: "PATCH",
      }),
      routeContext,
    );

    expect(response.status).toBe(200);
    expect(editSong).toHaveBeenCalledWith(
      context,
      "019a0170-0000-7000-8000-000000000002",
      legacyInput,
    );
  });

  it.each(["SONG_SLUG_ALREADY_EXISTS", "SONG_SLUG_IMMUTABLE"] as const)(
    "maps %s to a safe conflict",
    async (code) => {
      editSong.mockRejectedValue(new AppError(code));

      const response = await PATCH(
        new Request("https://example.test/api/admin/songs/019a0170-0000-7000-8000-000000000002", {
          body: JSON.stringify(input),
          headers: { "content-type": "application/json", Origin: "http://127.0.0.1:3001" },
          method: "PATCH",
        }),
        routeContext,
      );

      expect(response.status).toBe(409);
      expect(apiErrorResponseSchema.parse(await response.json())).toMatchObject({ code });
    },
  );

  it("returns 204 after deleting a song", async () => {
    deleteSong.mockResolvedValue(undefined);

    const response = await DELETE(
      new Request("https://example.test/api/admin/songs/019a0170-0000-7000-8000-000000000002", {
        method: "DELETE",
        headers: { Origin: "http://127.0.0.1:3001" },
      }),
      routeContext,
    );

    expect(response.status).toBe(204);
    expect(deleteSong).toHaveBeenCalledWith(context, "019a0170-0000-7000-8000-000000000002");
  });

  it("maps a missing song and an invalid path", async () => {
    deleteSong.mockRejectedValue(new AppError("SONG_NOT_FOUND"));
    const missing = await DELETE(
      new Request("https://example.test/api/admin/songs/019a0170-0000-7000-8000-000000000002", {
        method: "DELETE",
        headers: { Origin: "http://127.0.0.1:3001" },
      }),
      routeContext,
    );
    expect(missing.status).toBe(404);
    expect(apiErrorResponseSchema.parse(await missing.json()).code).toBe("SONG_NOT_FOUND");

    const invalid = await DELETE(
      new Request("https://example.test/api/admin/songs/nope", {
        method: "DELETE",
        headers: { Origin: "http://127.0.0.1:3001" },
      }),
      { params: Promise.resolve({ id: "nope" }) },
    );
    expect(invalid.status).toBe(400);
  });
});
