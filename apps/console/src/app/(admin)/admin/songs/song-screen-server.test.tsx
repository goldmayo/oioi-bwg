import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { getAdminSongInformation } from "@oioi-bwg/server/services/song-service";
import { forbidden, notFound, redirect } from "next/navigation";
import { beforeEach, expect, it, vi } from "vitest";

import { getRequestContext } from "@/server/auth/request-context";

import { SongScreenServer } from "./_ui/SongScreenServer";
import SongInformationPage from "./[id]/page";

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
vi.mock("@oioi-bwg/server/services/song-service", () => ({ getAdminSongInformation: vi.fn() }));
vi.mock("./_ui/AdminSongScreen", () => ({ AdminSongScreen: () => null }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), forbidden: vi.fn(), notFound: vi.fn() }));
const id = "019a0170-0000-7000-8000-000000000001";
const login = new Error("login");
const denied = new Error("denied");
const missing = new Error("missing");
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
    user: { id },
    ability: buildAbility({ accountId: id, role: "ADMIN" }),
  });
  vi.mocked(listAdminAlbums).mockResolvedValue({ items: [], nextCursor: null });
});
it.each(["view", "edit", "create"] as const)(
  "%s authenticates before data access",
  async (mode) => {
    vi.mocked(getRequestContext).mockResolvedValue({
      user: null,
      ability: buildAbility({ accountId: null, role: null }),
    });
    await expect(SongScreenServer({ id: mode === "create" ? undefined : id, mode })).rejects.toBe(
      login,
    );
    expect(getAdminSongInformation).not.toHaveBeenCalled();
    expect(listAdminAlbums).not.toHaveBeenCalled();
  },
);
it("denies non-admin access before data access", async () => {
  vi.mocked(getRequestContext).mockResolvedValue({
    user: { id },
    ability: buildAbility({ accountId: id, role: "USER" }),
  });
  await expect(SongScreenServer({ id, mode: "view" })).rejects.toBe(denied);
  expect(getAdminSongInformation).not.toHaveBeenCalled();
});
it("rejects malformed UUIDs before querying and maps a missing song to 404", async () => {
  await expect(SongScreenServer({ id: "bad-id", mode: "edit" })).rejects.toBe(missing);
  expect(getAdminSongInformation).not.toHaveBeenCalled();
  expect(listAdminAlbums).not.toHaveBeenCalled();
  vi.mocked(getAdminSongInformation).mockRejectedValue(new AppError("SONG_NOT_FOUND"));
  await expect(SongScreenServer({ id, mode: "view" })).rejects.toBe(missing);
});
it.each([
  ["UNAUTHENTICATED", login],
  ["FORBIDDEN", denied],
] as const)("maps %s service errors", async (code, error) => {
  vi.mocked(getAdminSongInformation).mockRejectedValue(new AppError(code));
  await expect(SongScreenServer({ id, mode: "edit" })).rejects.toBe(error);
});
it("uses one URL mode owner and treats ambiguous values as read-only", async () => {
  for (const [edit, mode] of [
    [undefined, "view"],
    ["true", "edit"],
    [["true", "false"], "view"],
  ] as const) {
    const result = await SongInformationPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({
        edit: typeof edit === "string" || edit === undefined ? edit : [...edit],
      }),
    });
    expect(result.props.mode).toBe(mode);
  }
});
