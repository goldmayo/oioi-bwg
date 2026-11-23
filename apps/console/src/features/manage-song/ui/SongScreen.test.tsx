import { createHttpTestServer } from "@oioi-bwg/config/vitest/http";
import type { QueryClient } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { http as handlers, HttpResponse } from "msw";
import Link from "next/link";
import { beforeEach as beforeHttp } from "vitest";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { albumQueryKeys } from "@/entities/album";
import { type AdminSongInformation, songQueryKeys } from "@/entities/song";

import { http } from "@/shared/api/http-client";

import { createQueryClientFixture } from "../../../../tests/query-client";

import { SongScreen } from "./SongScreen";

const server = createHttpTestServer(window.location.href);
const createClient = createQueryClientFixture();
beforeHttp(() => {
  vi.spyOn(http, "patch");
  vi.spyOn(http, "post");
});

const id = "019a0170-0000-7000-8000-000000000001";
const song: AdminSongInformation = {
  id,
  albumId: id,
  album: { name: "앨범" },
  title: "곡",
  slug: "song",
  youtubeId: "video",
  hasOfficialCheer: true,
  hasLyrics: true,
  isTitle: false,
  isVisible: true,
  order: 1,
  updatedAt: "",
  guideWrite: { guideId: id, lockVersion: 1 },
  cheerGuides: [
    {
      id,
      mode: "CONCERT",
      draftEditorAvailable: true,
      currentPublication: { action: "UNPUBLISH", sourceType: "FANDOM" },
    },
  ],
};
let client: QueryClient;
beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  client?.clear();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});
function setup(mode: "view" | "edit") {
  const fixture = createClient({
    defaultOptions: { queries: { staleTime: Infinity, retry: false }, mutations: { retry: false } },
  });
  client = fixture.client;
  client.setQueryData(songQueryKeys.adminInformation(id), song);
  client.setQueryData(albumQueryKeys.adminList(), {
    items: [{ id, name: "앨범" }],
    nextCursor: null,
  });
  const onMutationError = vi.fn();
  render(
    <fixture.wrapper>
      <Link href="/admin/songs">곡 관리</Link>
      <SongScreen id={id} mode={mode} canManage onMutationError={onMutationError} />
    </fixture.wrapper>,
  );
  return { onMutationError };
}

it("기본은 조회이며 legacy 공식 flag로 출처를 추론하지 않고 공연 모드별 작업본 진입을 제공한다", () => {
  setup("view");
  expect(screen.getByRole("heading", { name: song.title })).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
  expect(screen.getByText("팬덤")).toBeTruthy();
  expect(screen.queryByText("공식")).toBeNull();
  expect(screen.getAllByRole("img", { name: "비공개" })[0]).toBeTruthy();
  expect(screen.getByText("미등록")).toBeTruthy();
  expect(screen.getByRole("link", { name: /^편집$/ }).getAttribute("href")).toBe(
    `/admin/songs/${id}?edit=true`,
  );
  expect(screen.getByRole("link", { name: "콘서트 편집" }).getAttribute("href")).toBe(
    `/admin/cheer-guides/${id}/edit?returnTo=${encodeURIComponent(`/admin/songs/${id}`)}`,
  );
});

it("재조회·충돌 뒤에도 시작 버전으로 재시도하며 입력을 보존한다", async () => {
  const { onMutationError } = setup("edit");
  server.use(
    handlers.patch("*/api/admin/songs/:id", () =>
      HttpResponse.json({ code: "CHEER_GUIDE_CONFLICT", message: "충돌" }, { status: 409 }),
    ),
  );
  fireEvent.change(screen.getByLabelText("곡 제목"), { target: { value: "수정 중" } });
  await act(() =>
    client.setQueryData(songQueryKeys.adminInformation(id), {
      ...song,
      title: "다른 관리자 수정",
      guideWrite: { guideId: id, lockVersion: 7 },
    }),
  );
  for (let attempt = 1; attempt <= 2; attempt++) {
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    await waitFor(() => expect(onMutationError).toHaveBeenCalledTimes(attempt));
  }
  expect((screen.getByLabelText("곡 제목") as HTMLInputElement).value).toBe("수정 중");
  for (const [, options] of vi.mocked(http.patch).mock.calls)
    expect(options?.json).toMatchObject({
      title: "수정 중",
      guideWrite: song.guideWrite,
      hasOfficialCheer: true,
    });
});

it("취소와 앱 링크의 이탈 확인에서 계속 편집하면 초안과 초점을 보존한다", async () => {
  setup("edit");
  fireEvent.change(screen.getByLabelText("곡 제목"), { target: { value: "미저장" } });
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  await waitFor(() =>
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "계속 편집" })),
  );
  fireEvent.click(screen.getByRole("button", { name: "계속 편집" }));
  expect(screen.queryByRole("alertdialog")).toBeNull();
  fireEvent.click(screen.getByRole("link", { name: "곡 관리" }));
  expect(screen.getByRole("alertdialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "계속 편집" }));
  expect((screen.getByLabelText("곡 제목") as HTMLInputElement).value).toBe("미저장");
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(true);
  expect(http.patch).not.toHaveBeenCalled();
});
