import type { ReactNode } from "react";
import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import type { QueryClient } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http as handlers, HttpResponse } from "msw";
import { beforeEach as beforeHttp } from "vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { AdminAlbumSummary } from "@/entities/album";
import { albumQueryKeys } from "@/entities/album";
import { songQueryKeys } from "@/entities/song";

import { http } from "@/shared/api/http-client";

import { createQueryClientFixture } from "../../../../tests/query-client";

import { AlbumManagerClient } from "./AlbumManagerClient";

const server = createHttpTestServer(window.location.href);
const createClient = createQueryClientFixture();
beforeHttp(() => {
  vi.spyOn(http, "delete");
  vi.spyOn(http, "get");
});

vi.mock("@/shared/ui/dialog", () => {
  const Part = ({ children }: { children?: ReactNode }) => <>{children}</>;
  return {
    Dialog: ({ children, open }: { children?: ReactNode; open: boolean }) =>
      open ? <div>{children}</div> : null,
    DialogContent: Part,
    DialogDescription: Part,
    DialogFooter: Part,
    DialogHeader: Part,
    DialogTitle: Part,
  };
});

const album: AdminAlbumSummary = {
  id: "019a0170-0000-7000-8000-000000000001",
  name: "MANITO",
  slug: "manito",
  imgUrl: "https://assets.example.com/manito.webp",
  color: "#E85A9A",
  releaseDate: "2024-04-01T00:00:00.000Z",
  isVisible: true,
  createdAt: "2026-04-02T18:00:57.794Z",
};
const songCache = {
  items: [{ id: "019a0170-0000-7000-8000-000000000002", album: { name: album.name } }],
  nextCursor: null,
};

let queryClient: QueryClient;

function renderManager() {
  const fixture = createClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient = fixture.client;
  queryClient.setQueryData(albumQueryKeys.adminList(), { items: [album], nextCursor: null });
  queryClient.setQueryData(songQueryKeys.adminList(), songCache);
  const onNameChangeOrDelete = vi.fn(() => {
    void queryClient.invalidateQueries({ queryKey: songQueryKeys.adminList() });
  });

  render(
    <fixture.wrapper>
      <AlbumManagerClient canManage onNameChangeOrDelete={onNameChangeOrDelete} />
    </fixture.wrapper>,
  );

  return onNameChangeOrDelete;
}

beforeEach(() => vi.clearAllMocks());

afterEach(() => {
  cleanup();
  queryClient?.clear();
});

it("검색 결과에서 사라진 앨범의 선택을 유지하고 명시적으로 해제한다", () => {
  renderManager();
  fireEvent.click(screen.getByRole("checkbox", { name: `${album.name} 선택` }));
  fireEvent.change(screen.getByRole("textbox", { name: "앨범 검색" }), {
    target: { value: "없음" },
  });
  expect(screen.getByText("1개 선택됨")).toBeTruthy();
  expect(screen.queryByRole("checkbox", { name: `${album.name} 선택` })).toBeNull();
  fireEvent.change(screen.getByRole("textbox", { name: "앨범 검색" }), { target: { value: "" } });
  expect(
    screen.getByRole("checkbox", { name: `${album.name} 선택` }).getAttribute("aria-checked"),
  ).toBe("true");
  fireEvent.click(screen.getByRole("button", { name: "선택 해제" }));
  expect(
    screen.getByRole("checkbox", { name: `${album.name} 선택` }).getAttribute("aria-checked"),
  ).toBe("false");
});

it("refetches the active Album list and stales the Song list after delete", async () => {
  server.use(
    handlers.delete("*/api/admin/albums/:id", () => new HttpResponse(null, { status: 204 })),
  );
  server.use(
    handlers.get("*/api/admin/albums", () => HttpResponse.json({ items: [], nextCursor: null })),
  );
  const onNameChangeOrDelete = renderManager();

  fireEvent.click(screen.getByRole("button", { name: `${album.name} 관리` }));
  fireEvent.click(screen.getByRole("button", { name: "삭제" }));
  const deleteButtons = screen.getAllByRole("button", { name: "삭제" });
  fireEvent.click(deleteButtons[deleteButtons.length - 1]);

  await waitFor(() =>
    expect(http.delete).toHaveBeenCalledWith(
      "/api/admin/albums/019a0170-0000-7000-8000-000000000001",
    ),
  );
  await waitFor(() => expect(http.get).toHaveBeenCalledOnce());
  expect(onNameChangeOrDelete).toHaveBeenCalledOnce();
  expect(queryClient.getQueryData(albumQueryKeys.adminList())).toEqual({
    items: [],
    nextCursor: null,
  });
  expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(true);
});
