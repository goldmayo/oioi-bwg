import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { cheerGuideQueryKeys } from "@/entities/cheer-guide";
import { songQueryKeys } from "@/entities/song";

import { useGuideCreationScreen } from "./use-guide-creation-screen";

const post = vi.hoisted(() => vi.fn());
const handleMutationError = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/http-client", () => ({
  http: { get: async () => ({ items: [], nextCursor: null }), post },
}));
vi.mock("@/features/auth", () => ({
  authAbilityQueries: {
    current: () => ({
      queryKey: ["ability"],
      queryFn: async () => ({ rules: [] }),
      initialData: { rules: [] },
    }),
  },
  createClientAbility: () => ({ can: () => true }),
  useAdminReauthentication: () => ({ requiresReauthentication: false, handleMutationError }),
}));
afterEach(cleanup);
beforeEach(() => {
  vi.clearAllMocks();
});
const id = "019a0170-0000-7000-8000-000000000001";
const input = {
  songId: id,
  mode: "CONCERT",
  sourceType: "FANDOM",
  sourceUrl: null,
  guideVideoUrl: null,
  description: null,
} as const;
function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(songQueryKeys.adminList(), { items: [], nextCursor: null });
  const invalidate = vi.spyOn(client, "invalidateQueries").mockResolvedValue(undefined);
  const { result } = renderHook(() => useGuideCreationScreen(id), {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  return { result, invalidate };
}
it("생성 결과 계약을 검증하고 관련 응원법·곡 정보만 무효화한다", async () => {
  post.mockResolvedValue({ id });
  const { result, invalidate } = setup();
  await act(async () => {
    await result.current.submit(input);
  });
  expect(post).toHaveBeenCalledWith("/api/admin/cheer-guides", { json: input });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: cheerGuideQueryKeys.adminList() });
  expect(invalidate).toHaveBeenCalledWith({ queryKey: songQueryKeys.adminInformation(id) });
  expect(handleMutationError).not.toHaveBeenCalled();
});
it("잘못된 성공 응답도 완료로 처리하지 않고 재인증·오류 처리에 전달한다", async () => {
  post.mockResolvedValue({ id: "invalid" });
  const { result, invalidate } = setup();
  await act(async () => {
    await expect(result.current.submit(input)).rejects.toThrow();
  });
  expect(invalidate).not.toHaveBeenCalled();
  expect(handleMutationError).toHaveBeenCalledTimes(1);
});
