import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { getAdminSongEditorBySlug, listAdminSongs } from "@oioi-bwg/server/services/song-service";
import { forbidden, notFound, redirect } from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { getRequestContext } from "@/server/auth/request-context";

import AdminAlbumsPage from "./albums/page";
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
vi.mock("@oioi-bwg/server/services/album-service", () => ({ listAdminAlbums: vi.fn() }));
vi.mock("@oioi-bwg/server/services/song-service", () => ({
  listAdminSongs: vi.fn(),
  getAdminSongEditorBySlug: vi.fn(),
}));
vi.mock("./albums/_ui/AdminAlbumManager", () => ({ AdminAlbumManager: () => null }));
vi.mock("./songs/_ui/AdminSongManager", () => ({ AdminSongManager: () => null }));
vi.mock("./edit/[slug]/_ui/AdminLyricsEditor", () => ({ AdminLyricsEditor: () => null }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), forbidden: vi.fn(), notFound: vi.fn() }));

const login = new Error("login requested");
const denied = new Error("access denied");
const missing = new Error("not found");
const pages = [
  ["dashboard", () => AdminPage(), listAdminSongs],
  ["albums", () => AdminAlbumsPage(), listAdminAlbums],
  ["songs", () => AdminSongsPage(), listAdminSongs],
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
