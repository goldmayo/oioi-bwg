import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import type { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http as handlers, HttpResponse } from "msw";
import { beforeEach as beforeHttp } from "vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { albumQueryKeys } from "@/entities/album";
import { cheerGuideQueryKeys } from "@/entities/cheer-guide";
import { songQueryKeys } from "@/entities/song";
import { waveformQueryKeys } from "@/entities/waveform";

import { http } from "@/shared/api/http-client";

import { createQueryClientFixture } from "../../../../../../../tests/query-client";

import { AdminLyricsEditor } from "./AdminLyricsEditor";

const server = createHttpTestServer(window.location.href);
const createClient = createQueryClientFixture();
beforeHttp(() => {
  vi.spyOn(http, "get");
  vi.spyOn(http, "patch");
});

const auth = vi.hoisted(() => ({
  query: vi.fn(() => Promise.resolve({ rules: [{ action: "manage", subject: "all" }] })),
}));

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
      saveSongData: (id: string, input: { lyrics: []; youtubeId: string }) => Promise<void>;
      song: { id: string; youtubeId: string };
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
  id: "019a0170-0000-7000-8000-000000000002",
  title: "고민중독",
  youtubeId: "initial-id",
  lyrics: [],
};
let queryClient: QueryClient;

function renderEditor() {
  const fixture = createClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient = fixture.client;
  queryClient.setQueryData(["auth", "ability"], {
    rules: [{ action: "manage", subject: "all" }],
  });
  queryClient.setQueryData(albumQueryKeys.adminList(), {
    items: [{ id: "019a0170-0000-7000-8000-000000000001" }],
    nextCursor: null,
  });
  queryClient.setQueryData(songQueryKeys.adminList(), {
    items: [{ id: song.id }],
    nextCursor: null,
  });

  queryClient.setQueryData(cheerGuideQueryKeys.adminList(), { items: [], nextCursor: null });
  queryClient.setQueryData(waveformQueryKeys.song("admin", song.id), null);
  queryClient.setQueryData(waveformQueryKeys.song("other", song.id), null);

  render(
    <fixture.wrapper>
      <AdminLyricsEditor song={song} accountId="admin" />
    </fixture.wrapper>,
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
  it("stales the Song list and current account waveform after save while preserving the local draft", async () => {
    server.use(
      handlers.patch("*/api/admin/songs/:id/lyrics", () => HttpResponse.json({ id: song.id })),
    );
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
    expect(queryClient.getQueryState(cheerGuideQueryKeys.adminList())?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(albumQueryKeys.adminList())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(["auth", "ability"])?.isInvalidated).toBe(false);
    expect((draft as HTMLInputElement).value).toBe("changed-id");
    expect(queryClient.getQueryState(waveformQueryKeys.song("admin", song.id))?.isInvalidated).toBe(
      true,
    );
    expect(queryClient.getQueryState(waveformQueryKeys.song("other", song.id))?.isInvalidated).toBe(
      false,
    );
    expect(auth.query).not.toHaveBeenCalled();
  });

  it("does not stale data lists on failure and keeps the existing 403 ability refresh", async () => {
    server.use(
      handlers.patch("*/api/admin/songs/:id/lyrics", () =>
        HttpResponse.json({ code: "FORBIDDEN", message: "접근 권한이 없습니다." }, { status: 403 }),
      ),
    );
    renderEditor();

    const draft = screen.getByRole("textbox", { name: "YouTube ID draft" });
    fireEvent.change(draft, { target: { value: "unsaved-id" } });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));

    await waitFor(() => expect(auth.query).toHaveBeenCalledOnce());
    expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(albumQueryKeys.adminList())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(cheerGuideQueryKeys.adminList())?.isInvalidated).toBe(false);
    expect((draft as HTMLInputElement).value).toBe("unsaved-id");
  });
});

it("refreshes ability on 401, keeps the draft and requests reauthentication", async () => {
  server.use(
    handlers.patch("*/api/admin/songs/:id/lyrics", () =>
      HttpResponse.json(
        { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." },
        { status: 401 },
      ),
    ),
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
  server.use(
    handlers.get("*/api/auth/ability", () =>
      HttpResponse.json({ rules: [{ action: "manage", subject: "all" }] }),
    ),
  );
  server.use(
    handlers.patch("*/api/admin/songs/:id/lyrics", () => HttpResponse.json({ id: song.id })),
  );
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
  server.use(
    handlers.patch("*/api/admin/songs/:id/lyrics", () =>
      HttpResponse.json({ code: "INTERNAL_SERVER_ERROR", message: "오류" }, { status: 500 }),
    ),
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
  server.use(
    handlers.patch("*/api/admin/songs/:id/lyrics", () =>
      HttpResponse.json(
        { code: "UNAUTHENTICATED", message: "로그인이 필요합니다." },
        { status: 401 },
      ),
    ),
  );
  auth.query.mockResolvedValue({ rules: [] });
  renderEditor();
  fireEvent.change(screen.getByRole("textbox", { name: "YouTube ID draft" }), {
    target: { value: "unsaved-id" },
  });
  fireEvent.click(screen.getByRole("button", { name: "저장" }));
  await screen.findByRole("link", { name: "다시 로그인" });
  server.use(handlers.get("*/api/auth/ability", () => HttpResponse.json({ rules: [] })));
  fireEvent.click(screen.getByRole("button", { name: "로그인 상태 확인" }));
  await screen.findByText("관리자 로그인이 확인되지 않았습니다. 계정 상태와 권한을 확인해주세요.");
  server.use(handlers.get("*/api/auth/ability", () => HttpResponse.error()));
  fireEvent.click(screen.getByRole("button", { name: "로그인 상태 확인" }));
  await screen.findByText("로그인 상태를 확인하지 못했습니다. 잠시 후 다시 시도해주세요.");
  expect(screen.getByRole("button", { name: "저장" }).closest("fieldset")?.disabled).toBe(true);
  expect(
    (screen.getByRole("textbox", { name: "YouTube ID draft" }) as HTMLInputElement).value,
  ).toBe("unsaved-id");
  expect(http.patch).toHaveBeenCalledOnce();
});
