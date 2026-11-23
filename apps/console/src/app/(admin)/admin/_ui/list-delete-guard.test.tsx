import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import type { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { http as handlers, HttpResponse } from "msw";
import { beforeEach as beforeHttp } from "vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { AlbumManagerClient } from "@/features/manage-album";
import { SongManagerClient } from "@/features/manage-song";

import { albumQueryKeys } from "@/entities/album";
import { songQueryKeys } from "@/entities/song";

import { http } from "@/shared/api/http-client";

import { createQueryClientFixture } from "../../../../../tests/query-client";

const server = createHttpTestServer(window.location.href);
const createClient = createQueryClientFixture();
let queryFixture: ReturnType<typeof createClient>;
beforeHttp(() => {
  vi.spyOn(http, "delete");
});

const id = (number: number) => `019a0170-0000-7000-8000-${String(number).padStart(12, "0")}`;
let client: QueryClient;
beforeEach(() => {
  vi.mocked(http.delete).mockReset();
});
afterEach(() => {
  cleanup();
  client?.clear();
});

function setup(kind: "song" | "album") {
  queryFixture = createClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } },
  });
  client = queryFixture.client;
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
    <queryFixture.wrapper>
      {kind === "song" ? (
        <SongManagerClient canManage onMutationError={onError} />
      ) : (
        <AlbumManagerClient canManage onMutationError={onError} />
      )}
    </queryFixture.wrapper>,
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
    const response = Promise.withResolvers<Response>();
    server.use(handlers.delete("*/api/admin/:kind/:id", () => response.promise));
    const { rows } = setup(kind);
    const open = (index: number) => openRowDelete(rows[index]!);
    open(0);
    let dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제", hidden: true }));
    await waitFor(() => expect(http.delete).toHaveBeenCalledOnce());
    expect(within(dialog).getByRole("button", { name: "취소" })).toHaveProperty("disabled", true);
    expect(within(dialog).queryByRole("button", { name: "Close" })).toBeNull();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    fireEvent.click(within(dialog).getByRole("button", { name: "취소" }));
    open(1);
    dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain(kind === "song" ? "곡 1" : "앨범 1");
    fireEvent.click(within(dialog).getByRole("button", { name: "삭제", hidden: true }));
    expect(http.delete).toHaveBeenCalledOnce();
    await act(async () => {
      response.resolve(new HttpResponse(null, { status: 204 }));
    });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    open(1);
    expect(screen.getByRole("dialog").textContent).toContain(kind === "song" ? "곡 2" : "앨범 2");
    expect(http.delete).toHaveBeenCalledWith(
      `/api/admin/${kind === "song" ? "songs" : "albums"}/${id(1)}`,
    );
  },
);

it.each(["song", "album"] as const)(
  "%s: 실패한 대상은 유지하고 취소 또는 다음 삭제를 허용한다",
  async (kind) => {
    const error = new Error("삭제 실패");
    server.use(
      handlers.delete(
        "*/api/admin/:kind/:id",
        () =>
          HttpResponse.json(
            { code: "INTERNAL_SERVER_ERROR", message: error.message },
            { status: 500 },
          ),
        { once: true },
      ),
      handlers.delete("*/api/admin/:kind/:id", () => new HttpResponse(null, { status: 204 })),
    );
    const { rows, onError } = setup(kind);
    openRowDelete(rows[0]!);
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", {
        name: "삭제",

        hidden: true,
      }),
    );
    await waitFor(() => expect(onError).toHaveBeenCalledOnce());
    const failure = await vi
      .mocked(http.delete)
      .mock.results[0].value.catch((caught: unknown) => caught);
    expect(failure).toMatchObject({
      status: 500,
      code: "INTERNAL_SERVER_ERROR",
      message: error.message,
    });
    expect(onError.mock.calls[0]?.[0]).toBe(failure);
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
    expect(http.delete).toHaveBeenCalledTimes(2);
    expect(http.delete).toHaveBeenLastCalledWith(
      `/api/admin/${kind === "song" ? "songs" : "albums"}/${id(2)}`,
    );
  },
);
