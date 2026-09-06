import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { albumQueryKeys } from "@/entities/album";
import { songQueryKeys } from "@/entities/song";

import { AdminAlbumManager } from "./AdminAlbumManager";

vi.mock("@/features/manage-album", () => ({
  AlbumManagerClient: ({
    canManage,
    onNameChangeOrDelete,
  }: {
    canManage: boolean;
    onNameChangeOrDelete?: () => void;
  }) => (
    <button type="button" disabled={!canManage} onClick={onNameChangeOrDelete}>
      이름 변경 또는 삭제 완료
    </button>
  ),
}));
vi.mock("@/features/auth", () => ({
  authAbilityQueries: {
    current: () => ({
      queryFn: () => Promise.resolve({ rules: [] }),
      queryKey: ["auth", "ability"],
      staleTime: 30_000,
    }),
  },
  authAbilityQueryKeys: { ability: () => ["auth", "ability"] },
  createClientAbility: () => ({ can: () => true }),
}));
vi.mock("../_lib/upload-album-image-action", () => ({
  uploadAlbumImageAction: vi.fn(),
}));

let queryClient: QueryClient;

afterEach(() => {
  cleanup();
  queryClient?.clear();
});

describe("AdminAlbumManager cache composition", () => {
  it("invalidates only the Song admin list for a name-change/delete effect", async () => {
    queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    queryClient.setQueryData(["auth", "ability"], {
      rules: [{ action: "manage", subject: "all" }],
    });
    queryClient.setQueryData(albumQueryKeys.adminList(), [{ id: 1 }]);
    queryClient.setQueryData(songQueryKeys.adminList(), [{ id: 2 }]);
    queryClient.setQueryData(songQueryKeys.detail("test-song"), { id: 2 });

    render(
      <QueryClientProvider client={queryClient}>
        <AdminAlbumManager />
      </QueryClientProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "이름 변경 또는 삭제 완료" }));

    await waitFor(() =>
      expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(albumQueryKeys.adminList())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(songQueryKeys.detail("test-song"))?.isInvalidated).toBe(false);
  });
});
