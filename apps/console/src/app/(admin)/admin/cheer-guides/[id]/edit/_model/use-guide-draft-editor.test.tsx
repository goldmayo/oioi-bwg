import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { cheerGuideQueryKeys } from "@/entities/cheer-guide";

import { ApiError } from "@/shared/api/http-errors";

import { useGuideDraftEditor } from "./use-guide-draft-editor";

const { patch, get, handleMutationError, access } = vi.hoisted(() => ({
  access: { manage: true, recover: false },
  patch: vi.fn(),
  get: vi.fn(),
  handleMutationError: vi.fn(),
}));
vi.mock("@/shared/api/http-client", () => ({ http: { patch, get } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/features/auth", () => ({
  authAbilityQueries: {
    current: () => ({
      queryKey: ["ability"],
      queryFn: async () => ({ rules: [] }),
      initialData: { rules: [] },
    }),
  },
  createClientAbility: () => ({ can: () => access.manage }),
  useAdminReauthentication: () => ({
    requiresReauthentication: access.recover,
    handleMutationError,
  }),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
  access.manage = true;
  access.recover = false;
});
const id = "019a0170-0000-7000-8000-000000000001";
const songId = "019a0170-0000-7000-8000-000000000002";
const guide = {
  id,
  mode: "FESTIVAL",
  lockVersion: 1,
  song: { id: songId, title: "곡", albumName: "앨범", currentYoutubeId: "current-id" },
  referenceYoutubeId: "snapshot-id",
  lyrics: [
    {
      startTime: 0,
      isExtra: false,
      segments: [{ text: "원본", isCheer: false, isEcho: false, startTimeOffset: 0 }],
    },
  ],
};
function setup() {
  get.mockResolvedValue(guide);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  client.setQueryData(cheerGuideQueryKeys.editor(id), guide);
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  const hook = renderHook(() => useGuideDraftEditor(id), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { ...hook, client, invalidate };
}
const input = {
  youtubeId: guide.referenceYoutubeId,
  lyrics: guide.lyrics,
  guideWrite: { guideId: id, lockVersion: 1 },
};
it("Guide endpoint에 저장하고 재조회가 편집 시작 snapshot을 바꾸지 않는다", async () => {
  patch.mockResolvedValueOnce({ id, lockVersion: 2 }).mockResolvedValueOnce({ id, lockVersion: 3 });
  const { result, client, invalidate } = setup();
  let saved: Awaited<ReturnType<typeof result.current.saveSongData>>;
  await act(async () => {
    saved = await result.current.saveSongData(songId, input);
  });
  expect(patch).toHaveBeenLastCalledWith(`/api/admin/cheer-guides/${id}/draft`, {
    json: { expectedLockVersion: 1, lyrics: guide.lyrics },
  });
  act(() => {
    client.setQueryData(cheerGuideQueryKeys.editor(id), {
      ...guide,
      lockVersion: 99,
      referenceYoutubeId: "other-video",
    });
  });
  await act(async () => {
    await result.current.saveSongData(songId, { ...input, guideWrite: saved!.guideWrite });
  });
  expect(patch).toHaveBeenLastCalledWith(`/api/admin/cheer-guides/${id}/draft`, {
    json: { expectedLockVersion: 2, lyrics: guide.lyrics },
  });
  expect(result.current.song.youtubeId).toBe("snapshot-id");
  expect(invalidate).toHaveBeenCalledWith({ queryKey: cheerGuideQueryKeys.editor(id) });
});
it.each([401, 409])("%s 실패를 호출자에게 전달하고 자동 재전송하지 않는다", async (status) => {
  const error = new ApiError(status, {
    code: status === 401 ? "UNAUTHENTICATED" : "CHEER_GUIDE_CONFLICT",
    message: "저장 실패",
  });
  patch.mockRejectedValue(error);
  const { result } = setup();
  await act(async () => {
    await expect(result.current.saveSongData(songId, input)).rejects.toBe(error);
  });
  await waitFor(() => expect(handleMutationError.mock.calls[0]?.[0]).toBe(error));
  expect(patch).toHaveBeenCalledTimes(1);
});
it("다른 곡·Guide·기준 영상으로의 저장은 HTTP 요청 전에 거절한다", async () => {
  const { result } = setup();
  await expect(result.current.saveSongData(id, input)).rejects.toMatchObject({ status: 409 });
  await expect(
    result.current.saveSongData(songId, {
      ...input,
      guideWrite: { guideId: songId, lockVersion: 1 },
    }),
  ).rejects.toMatchObject({ status: 409 });
  await expect(
    result.current.saveSongData(songId, { ...input, youtubeId: "other" }),
  ).rejects.toMatchObject({ status: 409 });
  expect(patch).not.toHaveBeenCalled();
});

it.each([401, 403])("권한·인증 상태 %s에서는 서버 요청 없이 저장을 거절한다", async (status) => {
  access.manage = false;
  access.recover = status === 401;
  const { result } = setup();
  expect(result.current.canManage).toBe(false);
  await expect(result.current.saveSongData(songId, input)).rejects.toMatchObject({ status });
  expect(patch).not.toHaveBeenCalled();
});
