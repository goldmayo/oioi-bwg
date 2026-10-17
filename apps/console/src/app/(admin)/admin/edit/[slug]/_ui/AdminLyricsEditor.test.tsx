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
vi.mock("@/features/auth/api/actions", () => ({ signIn: vi.fn(), signOut: vi.fn() }));
vi.mock("@/features/auth", async () => ({
  ...(await vi.importActual<typeof import("@/features/auth")>("@/features/auth")),
  authAbilityQueries: {
    current: () => ({
      queryFn: auth.query,
      queryKey: ["auth", "ability"],
      staleTime: 30_000,
    }),
  },
  authAbilityQueryKeys: { ability: () => ["auth", "ability"] },
  createClientAbility: (rules: { action: string }[]) => ({
    cannot: () => !rules.some((rule) => rule.action === "manage"),
    can: () => rules.some((rule) => rule.action === "manage"),
  }),
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

beforeEach(() => {
  vi.resetAllMocks();
  auth.query.mockResolvedValue({ rules: [{ action: "manage", subject: "all" }] });
});

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

it("refreshes ability on 401, keeps the draft and requests reauthentication", async () => {
  http.patch.mockRejectedValue(
    new ApiError(401, { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." }),
  );
  auth.query.mockResolvedValueOnce({ rules: [] });
  renderEditor();
  const draft = screen.getByRole("textbox", { name: "YouTube ID draft" });
  fireEvent.change(draft, { target: { value: "unsaved-id" } });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(auth.query).toHaveBeenCalledOnce());
  expect(queryClient.getQueryData(["auth", "ability"])).toEqual({ rules: [] });
  expect(
    (screen.getByRole("textbox", { name: "YouTube ID draft" }) as HTMLInputElement).value,
  ).toBe("unsaved-id");
  expect(screen.getByRole("link", { name: "다시 로그인" }).getAttribute("target")).toBe("_blank");
  expect(screen.getByRole("button", { name: "저장" }).closest("fieldset")?.disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  expect(http.patch).toHaveBeenCalledOnce();
  http.get.mockResolvedValue({ rules: [{ action: "manage", subject: "all" }] });
  http.patch.mockResolvedValue({ id: song.id });
  fireEvent.click(screen.getByRole("button", { name: "로그인 상태 확인" }));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "저장" }).closest("fieldset")?.disabled).toBe(false),
  );
  expect(
    (screen.getByRole("textbox", { name: "YouTube ID draft" }) as HTMLInputElement).value,
  ).toBe("unsaved-id");
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() =>
    expect(http.patch).toHaveBeenLastCalledWith(`/api/admin/songs/${song.id}/lyrics`, {
      json: { lyrics: [], youtubeId: "unsaved-id" },
    }),
  );
});

it("keeps access and the draft on a server failure without requesting authentication", async () => {
  http.patch.mockRejectedValue(
    new ApiError(500, { code: "INTERNAL_SERVER_ERROR", message: "오류" }),
  );
  renderEditor();
  fireEvent.change(screen.getByRole("textbox", { name: "YouTube ID draft" }), {
    target: { value: "unsaved-id" },
  });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await waitFor(() => expect(http.patch).toHaveBeenCalledOnce());
  expect(auth.query).not.toHaveBeenCalled();
  expect(screen.queryByRole("link", { name: "다시 로그인" })).toBeNull();
  expect(
    (screen.getByRole("textbox", { name: "YouTube ID draft" }) as HTMLInputElement).value,
  ).toBe("unsaved-id");
});

it("keeps the draft blocked when a login check still lacks admin rights or fails", async () => {
  http.patch.mockRejectedValue(
    new ApiError(401, { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." }),
  );
  auth.query.mockResolvedValue({ rules: [] });
  renderEditor();
  fireEvent.change(screen.getByRole("textbox", { name: "YouTube ID draft" }), {
    target: { value: "unsaved-id" },
  });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await screen.findByRole("link", { name: "다시 로그인" });
  http.get.mockResolvedValue({ rules: [] });
  fireEvent.click(screen.getByRole("button", { name: "로그인 상태 확인" }));
  await screen.findByText("관리자 로그인이 확인되지 않았습니다. 계정 상태와 권한을 확인해주세요.");
  http.get.mockRejectedValue(new Error("network failure"));
  fireEvent.click(screen.getByRole("button", { name: "로그인 상태 확인" }));
  await screen.findByText("로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
  expect(screen.getByRole("button", { name: "저장" }).closest("fieldset")?.disabled).toBe(true);
  expect(
    (screen.getByRole("textbox", { name: "YouTube ID draft" }) as HTMLInputElement).value,
  ).toBe("unsaved-id");
  expect(http.patch).toHaveBeenCalledOnce();
});
