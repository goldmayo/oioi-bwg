import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminAlbumSummary } from "@/entities/album";
import { albumQueryKeys } from "@/entities/album";
import { songQueryKeys } from "@/entities/song";

import type { AlbumFormValues } from "../model/schemas";

import { AlbumManagerClient } from "./AlbumManagerClient";

const http = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  post: vi.fn(),
}));
const formHarness = vi.hoisted(() => ({
  values: {} as AlbumFormValues,
}));

vi.mock("@/shared/api/http-client", () => ({ http }));
vi.mock("./AlbumFormDialog", () => ({
  AlbumFormDialog: ({
    album,
    onSubmit,
    open,
  }: {
    album?: AdminAlbumSummary;
    onSubmit: (values: AlbumFormValues) => Promise<void>;
    open: boolean;
  }) =>
    open ? (
      <button
        type="button"
        onClick={() => void onSubmit(formHarness.values).catch(() => undefined)}
      >
        {album ? "편집 제출" : "생성 제출"}
      </button>
    ) : null,
}));
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
  id: 1,
  name: "MANITO",
  slug: "manito",
  imgUrl: "https://assets.example.com/manito.webp",
  color: "#E85A9A",
  releaseDate: "2024-04-01T00:00:00.000Z",
  isVisible: true,
  createdAt: "2026-04-02T18:00:57.794Z",
};
const songCache = [{ id: 2, album: { name: album.name } }];

let queryClient: QueryClient;

function renderManager() {
  queryClient = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
  queryClient.setQueryData(albumQueryKeys.adminList(), [album]);
  queryClient.setQueryData(songQueryKeys.adminList(), songCache);
  const onNameChangeOrDelete = vi.fn(() => {
    void queryClient.invalidateQueries({ queryKey: songQueryKeys.adminList() });
  });

  render(
    <QueryClientProvider client={queryClient}>
      <AlbumManagerClient
        canManage
        onUploadImage={vi.fn()}
        onNameChangeOrDelete={onNameChangeOrDelete}
      />
    </QueryClientProvider>,
  );

  return onNameChangeOrDelete;
}

async function submitEdit() {
  fireEvent.click(screen.getByTitle("수정"));
  fireEvent.click(screen.getByRole("button", { name: "편집 제출" }));
  await waitFor(() => expect(http.patch).toHaveBeenCalledOnce());
}

beforeEach(() => {
  vi.clearAllMocks();
  formHarness.values = {
    name: album.name,
    slug: album.slug,
    imgUrl: album.imgUrl,
    color: album.color,
    releaseDate: "2024-04-01",
    isVisible: album.isVisible,
  };
});

afterEach(() => {
  cleanup();
  queryClient?.clear();
});

describe("AlbumManagerClient cache orchestration", () => {
  it("keeps the Song list fresh after create", async () => {
    const created = { ...album, id: 3, name: "NEW", slug: "new" };
    http.post.mockResolvedValue(created);
    http.get.mockResolvedValue([album, created]);
    const onNameChangeOrDelete = renderManager();

    fireEvent.click(screen.getByRole("button", { name: /앨범 추가/ }));
    fireEvent.click(screen.getByRole("button", { name: "생성 제출" }));

    await waitFor(() => expect(http.get).toHaveBeenCalledOnce());
    expect(onNameChangeOrDelete).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(false);
  });

  it("keeps the Song list fresh when an update returns the same name", async () => {
    http.patch.mockResolvedValue(album);
    http.get.mockResolvedValue([album]);
    const onNameChangeOrDelete = renderManager();

    await submitEdit();
    await waitFor(() => expect(http.get).toHaveBeenCalledOnce());

    expect(onNameChangeOrDelete).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(false);
  });

  it("refetches the active Album list and stales the Song list after a rename", async () => {
    const renamed = { ...album, name: "MANITO RENAMED" };
    formHarness.values.name = renamed.name;
    http.patch.mockResolvedValue(renamed);
    http.get.mockResolvedValue([renamed]);
    const onNameChangeOrDelete = renderManager();

    await submitEdit();
    await waitFor(() => expect(http.get).toHaveBeenCalledOnce());

    expect(onNameChangeOrDelete).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(albumQueryKeys.adminList())).toEqual([renamed]);
    expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(true);
  });

  it("refetches the active Album list and stales the Song list after delete", async () => {
    http.delete.mockResolvedValue(undefined);
    http.get.mockResolvedValue([]);
    const onNameChangeOrDelete = renderManager();

    fireEvent.click(screen.getByTitle("삭제"));
    const deleteButtons = screen.getAllByRole("button", { name: "삭제" });
    fireEvent.click(deleteButtons[deleteButtons.length - 1]);

    await waitFor(() => expect(http.delete).toHaveBeenCalledWith("/api/admin/albums/1"));
    await waitFor(() => expect(http.get).toHaveBeenCalledOnce());
    expect(onNameChangeOrDelete).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(albumQueryKeys.adminList())).toEqual([]);
    expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(true);
  });

  it("does not invalidate either list when update fails", async () => {
    http.patch.mockRejectedValue(new Error("update failed"));
    const onNameChangeOrDelete = renderManager();

    await submitEdit();

    expect(onNameChangeOrDelete).not.toHaveBeenCalled();
    expect(http.get).not.toHaveBeenCalled();
    expect(queryClient.getQueryState(albumQueryKeys.adminList())?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(songQueryKeys.adminList())?.isInvalidated).toBe(false);
  });
});
