import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";

import { cheerGuideQueryKeys } from "@/entities/cheer-guide";

import { useGuideList } from "./use-guide-list";

afterEach(cleanup);
it("같은 곡의 모드별 선택을 구분하고 필터·재조회에도 선택을 보존한다", async () => {
  const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity } } });
  const ids = ["019a0170-0000-7000-8000-000000000001", "019a0170-0000-7000-8000-000000000002"];
  const song = {
    id: "019a0170-0000-7000-8000-000000000003",
    title: "곡",
    slug: "song",
    albumName: "앨범",
  };
  const items = (["CONCERT", "FESTIVAL"] as const).map((mode, index) => ({
    id: ids[index],
    mode,
    song,
    updatedAt: "",
    currentPublication: null,
    editorAvailable: false,
  }));
  client.setQueryData(cheerGuideQueryKeys.adminList(), { items, nextCursor: null });
  const { result, unmount } = renderHook(useGuideList, {
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  });
  act(() => result.current.setSelection({ [ids[0]]: true, [ids[1]]: true }));
  act(() => result.current.changeFilter("mode", "FESTIVAL"));
  expect(result.current.guides.map((guide) => guide.id)).toEqual([ids[1]]);
  expect(result.current.selected.map((guide) => guide.id)).toEqual(ids);
  await act(() =>
    client.setQueryData(cheerGuideQueryKeys.adminList(), { items: [items[1]], nextCursor: null }),
  );
  await waitFor(() => expect(result.current.selected.map((guide) => guide.id)).toEqual([ids[1]]));
  act(() => result.current.setSelection({}));
  expect(result.current.selected).toEqual([]);
  unmount();
  client.clear();
});
