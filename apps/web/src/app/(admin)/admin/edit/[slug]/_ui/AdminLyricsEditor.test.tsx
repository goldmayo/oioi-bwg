import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { albumQueryKeys } from "@/entities/album";
import { songQueryKeys } from "@/entities/song";

import { ApiError } from "@/shared/api/http-errors";

import { AdminLyricsEditor } from "./AdminLyricsEditor";

const http = vi.hoisted(() => ({
  get: vi.fn(),
  patch: vi.fn(),
}));
const auth = vi.hoisted(() => ({
  query: vi.fn(() => Promise.resolve({ rules: [{ action: "manage", subject: "all" }] })),
}));

vi.mock("@/shared/api/http-client", () => ({ http }));
vi.mock("@/features/auth", () => ({
  authAbilityQueries: {
    current: () => ({
      queryFn: auth.query,
      queryKey: ["auth", "ability"],
      staleTime: 30_000,
    }),
  },
  authAbilityQueryKeys: { ability: () => ["auth", "ability"] },
  createClientAbility: () => ({ cannot: () => false }),
}));
vi.mock("@/features/manage-lyrics", async () => {
  const { useState } = await import("react");
  return {
    LazyLyricsEditor: ({
      saveSongData,
      song,
    }: {
      saveSongData: (id: number, input: { lyrics: []; youtubeId: string }) => Promise<void>;
      song: { id: number; youtubeId: string };
    }) => {
      const [youtubeId, setYoutubeId] = useState(song.youtubeId);
      return (
        <div>
          <input
            aria-label="YouTube ID draft"
            value={youtubeId}
            onChange={(event) => setYoutubeId(event.target.value)}
          />
          <button
            type="button"
            onClick={() =>
              void saveSongData(song.id, { lyrics: [], youtubeId }).catch(() => undefined)
            }
          >
            저장
          </button>
        </div>
      );
    },
  };
});

const song = {
  id: 2,
  title: "고민중독",
  youtubeId: "initial-id",
  lyrics: [],
};
let queryClient: QueryClient;

function renderEditor() {
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient.setQueryData(["auth", "ability"], {
    rules: [{ action: "manage", subject: "all" }],
  });
  queryClient.setQueryData(albumQueryKeys.adminList(), {
    items: [{ id: 1 }],
    nextCursor: null,
  });
  queryClient.setQueryData(songQueryKeys.adminList(), {
    items: [{ id: song.id }],
    nextCursor: null,
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AdminLyricsEditor song={song} />
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  cleanup();
  queryClient?.clear();
});

describe("AdminLyricsEditor cache orchestration", () => {
  it("stales only the Song admin list after save and preserves the local draft", async () => {
    http.patch.mockResolvedValue({ id: song.id });
    renderEditor();

    const draft = screen.getByRole("textbox", { name: "YouTube ID draft" });
    fireEvent.change(draft, { target: { value: "changed-id" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() =>
      expect(http.patch).toHaveBeenCalledWith(`/api/admin/songs/${song.id}/lyrics`, {
        json: { lyrics: [], youtubeId: "changed-id" },
      }),
    );
    await waitFor(() =>
      expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(true),
    );
    expect(queryClient.getQueryState(albumQueryKeys.adminList())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(["auth", "ability"])?.isInvalidated).toBe(false);
    expect((draft as HTMLInputElement).value).toBe("changed-id");
    expect(auth.query).not.toHaveBeenCalled();
  });

  it("does not stale data lists on failure and keeps the existing 403 ability refresh", async () => {
    http.patch.mockRejectedValue(
      new ApiError(403, { code: "FORBIDDEN", message: "접근 권한이 없습니다." }),
    );
    renderEditor();

    const draft = screen.getByRole("textbox", { name: "YouTube ID draft" });
    fireEvent.change(draft, { target: { value: "unsaved-id" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(auth.query).toHaveBeenCalledOnce());
    expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(albumQueryKeys.adminList())?.isInvalidated).toBe(false);
    expect((draft as HTMLInputElement).value).toBe("unsaved-id");
  });
});
