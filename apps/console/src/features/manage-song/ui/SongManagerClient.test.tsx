import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { albumQueryKeys } from "@/entities/album";
import { type AdminSongSummary, songQueryKeys } from "@/entities/song";

import { ApiError } from "@/shared/api/http-errors";

import type { SongEditValues } from "../model/schemas";

import { SongManagerClient } from "./SongManagerClient";

const http = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("@/shared/api/http-client", () => ({ http }));
vi.mock("./SongManagerTable", () => ({
  SongManagerTable: ({
    songs,
    onEdit,
  }: {
    songs: AdminSongSummary[];
    onEdit: (song: AdminSongSummary) => void;
  }) => (
    <button onClick={() => onEdit(songs[0])}>곡 수정 {songs[0].guideWrite?.lockVersion}</button>
  ),
}));
vi.mock("./SongFormDialog", () => ({
  SongFormDialog: ({
    onSubmit,
    song,
  }: {
    onSubmit: (values: SongEditValues) => Promise<void>;
    song: AdminSongSummary;
  }) => (
    <button
      onClick={() =>
        void onSubmit({
          albumId: song.albumId,
          title: song.title,
          slug: song.slug ?? "",
          youtubeId: song.youtubeId,
          hasOfficialCheer: song.hasOfficialCheer,
          isTitle: song.isTitle,
          isVisible: song.isVisible,
          order: song.order,
          lrcText: "[00:01.00]떼창",
        }).catch(() => undefined)
      }
    >
      LRC 제출
    </button>
  ),
}));

let client: QueryClient;
afterEach(() => {
  cleanup();
  client?.clear();
  vi.clearAllMocks();
});

it("목록이 갱신되거나 충돌해도 LRC 편집을 시작한 버전으로 제출한다", async () => {
  const id = "019a0170-0000-7000-8000-000000000001";
  const song: AdminSongSummary = {
    id,
    albumId: id,
    album: { name: "앨범" },
    title: "곡",
    slug: "song",
    youtubeId: "video",
    hasOfficialCheer: true,
    isTitle: false,
    isVisible: true,
    order: 1,
    updatedAt: "2026-10-26",
    guideWrite: { guideId: id, lockVersion: 1 },
  };
  client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(songQueryKeys.adminList(), { items: [song], nextCursor: null });
  client.setQueryData(albumQueryKeys.adminList(), { items: [], nextCursor: null });
  const onMutationError = vi.fn();
  http.patch.mockRejectedValue(
    new ApiError(409, { code: "CHEER_GUIDE_CONFLICT", message: "충돌" }),
  );
  render(
    <QueryClientProvider client={client}>
      <SongManagerClient canManage onMutationError={onMutationError} />
    </QueryClientProvider>,
  );
  fireEvent.click(screen.getByRole("button", { name: "곡 수정 1" }));
  await act(() =>
    client.setQueryData(songQueryKeys.adminList(), {
      items: [{ ...song, guideWrite: { guideId: id, lockVersion: 7 } }],
      nextCursor: null,
    }),
  );
  await screen.findByRole("button", { name: "곡 수정 7" });
  for (let attempt = 1; attempt <= 2; attempt++) {
    fireEvent.click(screen.getByRole("button", { name: "LRC 제출" }));
    await waitFor(() => expect(onMutationError).toHaveBeenCalledTimes(attempt));
  }
  for (const [, options] of http.patch.mock.calls) {
    expect(options.json).toMatchObject({ lrcText: "[00:01.00]떼창", guideWrite: song.guideWrite });
  }
});
