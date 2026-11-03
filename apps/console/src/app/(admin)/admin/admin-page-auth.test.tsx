import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { getAdminCheerGuideEditor } from "@oioi-bwg/server/services/cheer-guide-draft-service";
import { listAdminCheerGuides } from "@oioi-bwg/server/services/cheer-guide-service";
import {
  getAdminSongEditorBySlug,
  getAdminSongInformation,
  listAdminSongs,
} from "@oioi-bwg/server/services/song-service";
import { forbidden, notFound, redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRequestContext } from "@/server/auth/request-context";

import AdminAlbumsPage from "./albums/page";
import GuideEditPage from "./cheer-guides/[id]/edit/page";
import AdminCheerGuidesPage from "./cheer-guides/page";
import AdminLyricsEditPage from "./edit/[slug]/page";
import AdminPage from "./page";
import AdminSongsPage from "./songs/page";

vi.mock("@/server/auth/request-context", () => {
  const getRequestContext = vi.fn();
  return {
    getRequestContext,
    getRequestAuthorization: async () => ({
      context: await getRequestContext(),
      decision: "unknown",
      rejectionLogged: false,
    }),
  };
});
vi.mock("@/features/auth", () => ({
  authAbilityQueryKeys: { ability: () => ["auth", "ability"] },
}));
vi.mock("@oioi-bwg/server/services/cheer-guide-draft-service", () => ({
  getAdminCheerGuideEditor: vi.fn(),
}));
vi.mock("./cheer-guides/[id]/edit/_ui/GuideDraftEditor", () => ({ GuideDraftEditor: () => null }));
vi.mock("@oioi-bwg/server/services/cheer-guide-service", () => ({ listAdminCheerGuides: vi.fn() }));
vi.mock("./cheer-guides/_ui/AdminGuideList", () => ({ AdminGuideList: () => null }));
vi.mock("@oioi-bwg/server/services/album-service", () => ({ listAdminAlbums: vi.fn() }));
vi.mock("@oioi-bwg/server/services/song-service", () => ({
  listAdminSongs: vi.fn(),
  getAdminSongEditorBySlug: vi.fn(),
  getAdminSongInformation: vi.fn(),
}));
vi.mock("./albums/_ui/AdminAlbumManager", () => ({ AdminAlbumManager: () => null }));
vi.mock("./songs/_ui/AdminSongManager", () => ({ AdminSongManager: () => null }));
vi.mock("./edit/[slug]/_ui/AdminLyricsEditor", () => ({ AdminLyricsEditor: () => null }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), forbidden: vi.fn(), notFound: vi.fn() }));

const login = new Error("login requested");
const denied = new Error("access denied");
const missing = new Error("not found");
const pages = [
  [
    "guide edit",
    () =>
      GuideEditPage({
        params: Promise.resolve({ id: "019a0170-0000-7000-8000-000000000001" }),
        searchParams: Promise.resolve({}),
      }),
    getAdminCheerGuideEditor,
  ],
  ["dashboard", () => AdminPage(), listAdminSongs],
  ["albums", () => AdminAlbumsPage(), listAdminAlbums],
  ["songs", () => AdminSongsPage(), listAdminSongs],
  ["cheer-guides", () => AdminCheerGuidesPage(), listAdminCheerGuides],
  [
    "edit",
    () => AdminLyricsEditPage({ params: Promise.resolve({ slug: "test-song" }) }),
    getAdminSongEditorBySlug,
  ],
] as const;

beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(redirect).mockImplementation(() => {
    throw login;
  });
  vi.mocked(forbidden).mockImplementation(() => {
    throw denied;
  });
  vi.mocked(notFound).mockImplementation(() => {
    throw missing;
  });
  vi.mocked(getRequestContext).mockResolvedValue({
    user: { id: "019a0170-0000-7000-8000-00000000002a" },
    ability: buildAbility({ accountId: "019a0170-0000-7000-8000-00000000002a", role: "ADMIN" }),
  });
  vi.mocked(listAdminAlbums).mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(listAdminSongs).mockResolvedValue({ items: [], nextCursor: null });
  vi.mocked(listAdminCheerGuides).mockResolvedValue({ items: [], nextCursor: null });
});

describe.each(pages)("%s RSC auth delivery", (_name, render, service) => {
  it("requests login without calling a protected service for a guest", async () => {
    vi.mocked(getRequestContext).mockResolvedValue({
      user: null,
      ability: buildAbility({ accountId: null, role: null }),
    });
    await expect(render()).rejects.toBe(login);
    expect(listAdminAlbums).not.toHaveBeenCalled();
    expect(listAdminSongs).not.toHaveBeenCalled();
    expect(listAdminCheerGuides).not.toHaveBeenCalled();
    expect(getAdminSongEditorBySlug).not.toHaveBeenCalled();
  });

  it("requests access denial before a service for an authenticated non-admin", async () => {
    vi.mocked(getRequestContext).mockResolvedValue({
      user: { id: "019a0170-0000-7000-8000-00000000002a" },
      ability: buildAbility({ accountId: "019a0170-0000-7000-8000-00000000002a", role: "USER" }),
    });
    await expect(render()).rejects.toBe(denied);
    expect(service).not.toHaveBeenCalled();
  });

  it.each([
    ["UNAUTHENTICATED", login],
    ["FORBIDDEN", denied],
  ] as const)("translates service %s", async (code, signal) => {
    vi.mocked(service).mockRejectedValue(new AppError(code));
    await expect(render()).rejects.toBe(signal);
  });

  it("leaves an unexpected service failure for Next error capture", async () => {
    const failure = new TypeError("unexpected service failure");
    vi.mocked(service).mockRejectedValue(failure);
    await expect(render()).rejects.toBe(failure);
    expect(redirect).not.toHaveBeenCalled();
    expect(forbidden).not.toHaveBeenCalled();
  });
});

it("keeps the editor not-found response after successful authentication", async () => {
  vi.mocked(getAdminSongEditorBySlug).mockResolvedValue(undefined);
  await expect(
    AdminLyricsEditPage({ params: Promise.resolve({ slug: "missing-song" }) }),
  ).rejects.toBe(missing);
  expect(redirect).not.toHaveBeenCalled();
  expect(forbidden).not.toHaveBeenCalled();
});

const songId = "019a0170-0000-7000-8000-000000000010";
const guideId = "019a0170-0000-7000-8000-000000000001";
const otherModeId = "019a0170-0000-7000-8000-000000000002";
function editorFixture() {
  vi.mocked(getAdminSongEditorBySlug).mockResolvedValue({
    id: songId,
    title: "곡",
    lyrics: [],
    youtubeId: "video",
    guideWrite: { guideId, lockVersion: 1 },
  } as never);
  vi.mocked(getAdminSongInformation).mockResolvedValue({
    cheerGuides: [
      { id: guideId, draftEditorAvailable: true },
      { id: otherModeId, draftEditorAvailable: true },
    ],
  } as never);
}
it("곡에 속하지 않거나 잘못된 Guide 요청은 새 편집기로 연결하지 않는다", async () => {
  editorFixture();
  for (const requested of ["bad", "019a0170-0000-7000-8000-000000000003", [guideId, guideId]]) {
    await expect(
      AdminLyricsEditPage({
        params: Promise.resolve({ slug: "song" }),
        searchParams: Promise.resolve({ guideId: requested }),
      }),
    ).rejects.toBe(missing);
  }
  expect(redirect).not.toHaveBeenCalled();
});
it("명시한 다른 공연 모드도 해당 곡의 Guide이면 작업본 편집기로 연결한다", async () => {
  editorFixture();
  await expect(
    AdminLyricsEditPage({
      params: Promise.resolve({ slug: "song" }),
      searchParams: Promise.resolve({ guideId: otherModeId, returnTo: "//evil.test" }),
    }),
  ).rejects.toBe(login);
  expect(redirect).toHaveBeenCalledWith(
    `/admin/cheer-guides/${otherModeId}/edit?returnTo=${encodeURIComponent(`/admin/songs/${songId}`)}`,
  );
});
it("공연 모드가 없는 곡 URL에서는 곡 정보에서 모드를 선택한다", async () => {
  editorFixture();
  await expect(AdminLyricsEditPage({ params: Promise.resolve({ slug: "song" }) })).rejects.toBe(
    login,
  );
  expect(redirect).toHaveBeenCalledWith(`/admin/songs/${songId}#song-guides`);
});
it("응원법이 없는 곡의 기존 가사 편집은 유지한다", async () => {
  editorFixture();
  vi.mocked(getAdminSongInformation).mockResolvedValue({ cheerGuides: [] } as never);
  expect(await AdminLyricsEditPage({ params: Promise.resolve({ slug: "song" }) })).toBeTruthy();
  expect(redirect).not.toHaveBeenCalled();
});
it("내용 이력이 없는 Guide는 편집 진입을 허용하지 않는다", async () => {
  editorFixture();
  vi.mocked(getAdminSongInformation).mockResolvedValue({
    cheerGuides: [{ id: guideId, draftEditorAvailable: false }],
  } as never);
  await expect(
    AdminLyricsEditPage({
      params: Promise.resolve({ slug: "song" }),
      searchParams: Promise.resolve({ guideId }),
    }),
  ).rejects.toBe(missing);
});
it.each([
  ["UNAUTHENTICATED", login],
  ["FORBIDDEN", denied],
] as const)("추가 조회의 %s도 RSC 인증 응답으로 처리한다", async (code, signal) => {
  editorFixture();
  vi.mocked(getAdminSongInformation).mockRejectedValue(new AppError(code));
  await expect(AdminLyricsEditPage({ params: Promise.resolve({ slug: "song" }) })).rejects.toBe(
    signal,
  );
});

it.each([
  [undefined, "/admin/cheer-guides"],
  ["//evil.test", "/admin/cheer-guides"],
  [`/admin/songs/${songId}?edit=true`, `/admin/songs/${songId}?edit=true`],
] as const)("Guide 편집 복귀 경로 %s를 검증한다", async (returnTo, expected) => {
  vi.mocked(getAdminCheerGuideEditor).mockResolvedValue({
    id: guideId,
    mode: "FESTIVAL",
    lockVersion: 1,
    song: { id: songId, title: "곡", albumName: "앨범", currentYoutubeId: "video" },
    referenceYoutubeId: "video",
    lyrics: [],
  });
  const page = await GuideEditPage({
    params: Promise.resolve({ id: guideId }),
    searchParams: Promise.resolve({ returnTo }),
  });
  expect(page.props.children[1].props.returnTo.href).toBe(expected);
});
it("Guide 편집의 없는 대상은 404이고 잘못된 UUID는 조회 전에 차단한다", async () => {
  vi.mocked(getAdminCheerGuideEditor).mockRejectedValue(new AppError("CHEER_GUIDE_NOT_FOUND"));
  await expect(
    GuideEditPage({ params: Promise.resolve({ id: guideId }), searchParams: Promise.resolve({}) }),
  ).rejects.toBe(missing);
  vi.mocked(getAdminCheerGuideEditor).mockClear();
  await expect(
    GuideEditPage({ params: Promise.resolve({ id: "bad" }), searchParams: Promise.resolve({}) }),
  ).rejects.toBe(missing);
  expect(getAdminCheerGuideEditor).not.toHaveBeenCalled();
});
