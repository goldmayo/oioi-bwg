import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import { act, cleanup, renderHook } from "@testing-library/react";
import { http as handlers, HttpResponse } from "msw";
import { beforeEach as beforeHttp } from "vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { type AdminCheerGuideSummary, cheerGuideQueryKeys } from "@/entities/cheer-guide";

import { http } from "@/shared/api/http-client";
import { ApiError } from "@/shared/api/http-errors";

import { createQueryClientFixture } from "../../../../../../tests/query-client";

import { useGuideDeletion } from "./use-guide-deletion";

const server = createHttpTestServer(window.location.href);
const createClient = createQueryClientFixture();
beforeHttp(() => {
  vi.spyOn(http, "delete");
});

const recover = vi.hoisted(() => vi.fn());
vi.mock("@/features/auth", () => ({
  useAdminReauthentication: () => ({
    requiresReauthentication: false,
    handleMutationError: recover,
  }),
}));

const guides = ["CONCERT", "FESTIVAL"].map((mode, index) => ({
  id: `019a0170-0000-7000-8000-${String(index).padStart(12, "0")}`,
  mode,
  updatedAt: "",
  song: {
    id: "019a0170-0000-7000-8000-000000000003",
    title: "곡",
    slug: "song",
    albumName: "앨범",
  },
  currentPublication: null,
  editorAvailable: false,
  deletable: true,
})) as AdminCheerGuideSummary[];
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(http.delete).mockReset();
});
function setup(canManage = true) {
  const { client, wrapper } = createClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  client.setQueryData(cheerGuideQueryKeys.adminList(), { items: guides, nextCursor: null });
  const deleted = vi.fn();
  const hook = renderHook(({ allowed }) => useGuideDeletion(allowed, deleted), {
    initialProps: { allowed: canManage },
    wrapper,
  });
  return { ...hook, client, deleted };
}
it("권한과 이력을 확인하고 대상을 고정하며 중복 제출·진행 중 닫기를 막는다", async () => {
  const { result, client, deleted, rerender } = setup(false);
  act(() => result.current.requestDelete(guides));
  expect(result.current.targets).toEqual([]);
  rerender({ allowed: true });
  act(() => result.current.requestDelete([{ ...guides[0]!, deletable: false }]));
  expect(result.current.targets).toEqual([]);
  const input = [...guides];
  act(() => result.current.requestDelete(input));
  input.pop();
  expect(result.current.targets).toHaveLength(2);
  const started = Promise.withResolvers<void>();
  const response = Promise.withResolvers<Response>();
  server.use(
    handlers.delete(
      "*/api/admin/cheer-guides/:id",
      () => {
        started.resolve();
        return response.promise;
      },
      { once: true },
    ),
    handlers.delete("*/api/admin/cheer-guides/:id", () => new HttpResponse(null, { status: 204 })),
  );
  await act(async () => {
    const pending = result.current.confirm();
    await started.promise;
    result.current.close();
    void result.current.confirm();
    response.resolve(new HttpResponse(null, { status: 204 }));
    await pending;
  });
  expect(http.delete).toHaveBeenCalledTimes(2);
  expect(deleted).toHaveBeenCalledWith(guides.map(({ id }) => id));
  expect(result.current.targets).toEqual([]);
  expect(client.getQueryData(cheerGuideQueryKeys.adminList())).toMatchObject({ items: [] });
  client.clear();
});
it("일부 성공 뒤 이력 충돌이면 성공한 행만 지우고 실패·미실행 대상을 유지한다", async () => {
  const { result, client, deleted } = setup();
  const error = new ApiError(409, {
    code: "CHEER_GUIDE_HAS_HISTORY",
    message: "이력이 있어 삭제할 수 없습니다.",
  });
  const third = { ...guides[0]!, id: "019a0170-0000-7000-8000-000000000004" };
  const targets = [...guides, third];
  server.use(
    handlers.delete("*/api/admin/cheer-guides/:id", () => new HttpResponse(null, { status: 204 }), {
      once: true,
    }),
    handlers.delete("*/api/admin/cheer-guides/:id", () =>
      HttpResponse.json({ code: error.code, message: error.message }, { status: 409 }),
    ),
  );
  act(() => result.current.requestDelete(targets));
  await act(async () => {
    await result.current.confirm();
  });
  expect(http.delete).toHaveBeenCalledTimes(2);
  expect(deleted).toHaveBeenCalledWith([guides[0]!.id]);
  expect(result.current.targets).toEqual([guides[1], third]);
  expect(result.current.error).toBe(error.message);
  expect(recover).toHaveBeenCalledWith(error);
  expect(client.getQueryData(cheerGuideQueryKeys.adminList())).toMatchObject({
    items: [guides[1]],
  });
  client.clear();
});
it("재인증 오류는 대상을 보존하고 삭제 성공 뒤 조회 실패는 재삭제하지 않는다", async () => {
  const { result, client, deleted } = setup();
  const error = new ApiError(401, { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." });
  server.use(
    handlers.delete(
      "*/api/admin/cheer-guides/:id",
      () => HttpResponse.json({ code: error.code, message: error.message }, { status: 401 }),
      { once: true },
    ),
    handlers.delete("*/api/admin/cheer-guides/:id", () => new HttpResponse(null, { status: 204 })),
  );
  act(() => result.current.requestDelete([guides[0]!]));
  await act(async () => {
    await result.current.confirm();
  });
  expect(result.current.targets).toHaveLength(1);
  expect(deleted).not.toHaveBeenCalled();
  expect(recover).toHaveBeenCalledWith(error);
  vi.spyOn(client, "invalidateQueries").mockRejectedValue(new Error("refresh failed"));
  await act(async () => {
    await result.current.confirm();
  });
  expect(result.current.targets).toEqual([]);
  expect(deleted).toHaveBeenCalledTimes(1);
  expect(http.delete).toHaveBeenCalledTimes(2);
  client.clear();
});
