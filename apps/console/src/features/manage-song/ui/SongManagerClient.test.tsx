import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { albumQueryKeys } from "@/entities/album";
import { type AdminSongSummary, songQueryKeys } from "@/entities/song";

import { SongManagerClient } from "./SongManagerClient";

const http = vi.hoisted(() => ({ patch: vi.fn() }));
vi.mock("@/shared/api/http-client", () => ({ http }));
vi.mock("./SongManagerTable", () => ({
  SongManagerTable: ({
    songs,
    onEdit,
    onSelect,
  }: {
    songs: AdminSongSummary[];
    onEdit: (song: AdminSongSummary) => void;
    onSelect: (id: string, selected: boolean) => void;
  }) => (
    <>
      <button onClick={() => onEdit(songs[0])}>곡 수정 {songs[0].guideWrite?.lockVersion}</button>
      <button onClick={() => onSelect(songs[0].id, true)}>첫 곡 선택</button>
    </>
  ),
}));
let client: QueryClient;
afterEach(() => {
  cleanup();
  client?.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

it("선택한 곡만 JSON 파일로 내려받고 가사·서버 mutation을 실행하지 않는다", () => {
  const id = "019a0170-0000-7000-8000-000000000001";
  client = new QueryClient();
  client.setQueryData(songQueryKeys.adminList(), {
    items: [
      {
        id,
        albumId: id,
        album: { name: "앨범" },
        title: "곡",
        slug: "song",
        youtubeId: "pbELDkeLdho",
        hasOfficialCheer: false,
        isTitle: false,
        isVisible: true,
        order: 1,
        updatedAt: "2026-10-31",
      },
    ],
    nextCursor: null,
  });
  client.setQueryData(albumQueryKeys.adminList(), { items: [], nextCursor: null });
  const createObjectURL = vi.fn(() => "blob:test");
  const revokeObjectURL = vi.fn();
  vi.stubGlobal(
    "URL",
    class extends URL {
      static createObjectURL = createObjectURL;
      static revokeObjectURL = revokeObjectURL;
    },
  );
  let filename = "";
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    filename = this.download;
  });
  render(
    <QueryClientProvider client={client}>
      <SongManagerClient canManage />
    </QueryClientProvider>,
  );
  expect(
    (screen.getByRole("button", { name: "파형 작업 파일 다운로드 (0곡)" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "첫 곡 선택" }));
  fireEvent.click(screen.getByRole("button", { name: "파형 작업 파일 다운로드 (1곡)" }));
  expect(filename).toMatch(/^oioi-operator-waveform_\d{8}_\d{6}_\d{3}_KST\.json$/);
  expect(createObjectURL).toHaveBeenCalledOnce();
  expect(createObjectURL.mock.calls[0]).toHaveLength(1);
  expect(http.patch).not.toHaveBeenCalled();
});
