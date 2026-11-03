import { buildAbility } from "@oioi-bwg/server/auth/ability";
import { AppError } from "@oioi-bwg/server/errors/app-error";
import { listAdminAlbums } from "@oioi-bwg/server/services/album-service";
import { forbidden, notFound, redirect } from "next/navigation";
import { beforeEach, expect, it, vi } from "vitest";

import { getRequestContext } from "@/server/auth/request-context";

import { AlbumScreenServer } from "./_ui/AlbumScreenServer";

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
vi.mock("./_ui/AdminAlbumScreen", () => ({ AdminAlbumScreen: () => null }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), forbidden: vi.fn(), notFound: vi.fn() }));
const id = "019a0170-0000-7000-8000-000000000001";
const login = new Error("login"),
  denied = new Error("denied"),
  missing = new Error("missing");
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
it.each([undefined, id])("앨범 화면 %s는 조회 전 관리자 인증을 확인한다", async (id) => {
  vi.mocked(getRequestContext).mockResolvedValue({
    user: null,
    ability: buildAbility({ accountId: null, role: null }),
  });
  await expect(AlbumScreenServer({ id })).rejects.toBe(login);
  expect(listAdminAlbums).not.toHaveBeenCalled();
});
it("일반 계정은 조회하지 않는다", async () => {
  vi.mocked(getRequestContext).mockResolvedValue({
    user: { id },
    ability: buildAbility({ accountId: id, role: "USER" }),
  });
  await expect(AlbumScreenServer({ id })).rejects.toBe(denied);
  expect(listAdminAlbums).not.toHaveBeenCalled();
});
it("잘못된 UUID는 조회 전에 거절하고 삭제된 앨범은 404로 처리한다", async () => {
  await expect(AlbumScreenServer({ id: "invalid" })).rejects.toBe(missing);
  expect(listAdminAlbums).not.toHaveBeenCalled();
  await expect(AlbumScreenServer({ id })).rejects.toBe(missing);
});
it.each([
  ["UNAUTHENTICATED", login],
  ["FORBIDDEN", denied],
] as const)("서비스 %s도 기존 재인증 경계로 보낸다", async (code, error) => {
  vi.mocked(listAdminAlbums).mockRejectedValue(new AppError(code));
  await expect(AlbumScreenServer({ id })).rejects.toBe(error);
});
it("추가는 인증 후 빈 폼을 렌더링하며 불필요한 앨범 조회를 하지 않는다", async () => {
  await expect(AlbumScreenServer({})).resolves.toBeTruthy();
  expect(listAdminAlbums).not.toHaveBeenCalled();
});
