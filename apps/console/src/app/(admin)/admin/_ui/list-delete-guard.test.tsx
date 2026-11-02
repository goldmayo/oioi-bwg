import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { AlbumManagerClient } from "@/features/manage-album";
import { SongManagerClient } from "@/features/manage-song";

import { albumQueryKeys } from "@/entities/album";
import { songQueryKeys } from "@/entities/song";

const remove = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/http-client", () => ({ http: { delete: remove } }));
const id = (number: number) => `019a0170-0000-7000-8000-${String(number).padStart(12, "0")}`;
let client: QueryClient;
beforeEach(() => remove.mockReset());
afterEach(() => {
  cleanup();
  client?.clear();
});

function setup(kind: "song" | "album") {
  client = new QueryClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } },
  });
  vi.spyOn(client, "invalidateQueries").mockResolvedValue();
  const albums = [1, 2].map((number) => ({
    id: id(number),
    name: `앨범 ${number}`,
    slug: `album-${number}`,
    imgUrl: "https://example.invalid/album.webp",
    color: "#123456",
    releaseDate: null,
    isVisible: true,
    createdAt: "",
  }));
  const songs = [1, 2].map((number) => ({
    id: id(number),
    title: `곡 ${number}`,
    slug: `song-${number}`,
    albumId: id(1),
    album: { name: "앨범" },
    youtubeId: "pbELDkeLdho",
    hasOfficialCheer: false,
    isTitle: false,
    isVisible: true,
    order: number,
    updatedAt: "",
  }));
  client.setQueryData(albumQueryKeys.adminList(), { items: albums, nextCursor: null });
  client.setQueryData(songQueryKeys.adminList(), { items: songs, nextCursor: null });
  const onError = vi.fn();
  render(
    <QueryClientProvider client={client}>
      {kind === "song" ? (
        <SongManagerClient canManage onMutationError={onError} />
      ) : (
        <AlbumManagerClient canManage onUploadImage={vi.fn()} onMutationError={onError} />
      )}
    </QueryClientProvider>,
  );
  const rows = screen.getAllByRole("row").slice(1);
  return { rows, onError };
}

function openRowDelete(row: HTMLElement) {
  const trigger = within(row).getByRole("button", { name: /관리$/, hidden: true });
  fireEvent.click(trigger);
  const popover = screen.getByRole("dialog", { name: /작업$/, hidden: true });
  fireEvent.click(within(popover).getByRole("button", { name: "삭제", hidden: true }));
}

it.each(["song", "album"] as const)(
  "%s: 삭제 중 취소·Escape·대상 교체·중복 실행을 막는다",
  async (kind) => {
    let finish!: () => void;
    remove.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const { rows } = setup(kind);
    const open = (index: number) => openRowDelete(rows[index]!);
    open(0);
    let dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제", hidden: true }));
    await waitFor(() => expect(remove).toHaveBeenCalledOnce());
    expect(within(dialog).getByRole("button", { name: "취소" })).toHaveProperty("disabled", true);
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    open(1);
    dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain(kind === "song" ? "곡 1" : "앨범 1");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제", hidden: true }));
    expect(remove).toHaveBeenCalledOnce();
    await act(async () => {
      finish();
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    open(1);
    expect(screen.getByRole("dialog").textContent).toContain(kind === "song" ? "곡 2" : "앨범 2");
    expect(remove).toHaveBeenCalledWith(
      `/api/admin/${kind === "song" ? "songs" : "albums"}/${id(1)}`,
    );
  },
);

it.each(["song", "album"] as const)(
  "%s: 실패한 대상은 유지하고 취소 또는 다음 삭제를 허용한다",
  async (kind) => {
    const error = new Error("삭제 실패");
    remove.mockRejectedValueOnce(error).mockResolvedValueOnce(undefined);
    const { rows, onError } = setup(kind);
    openRowDelete(rows[0]!);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "삭제",

        hidden: true,
      }),
    );
    await waitFor(() => expect(onError.mock.calls[0]?.[0]).toBe(error));
    expect(screen.getByRole("dialog").textContent).toContain(kind === "song" ? "곡 1" : "앨범 1");
    await waitFor(() =>
      expect(
        within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }),
      ).toHaveProperty("disabled", false),
    );
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "취소" }));
    openRowDelete(rows[1]!);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "삭제",

        hidden: true,
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenLastCalledWith(
      `/api/admin/${kind === "song" ? "songs" : "albums"}/${id(2)}`,
    );
  },
);
