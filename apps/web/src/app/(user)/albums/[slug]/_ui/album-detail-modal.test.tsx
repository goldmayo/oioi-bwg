import "@testing-library/jest-dom/vitest";

import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import type { Album } from "@/entities/album";

import { AlbumDetailModal } from "./album-detail-modal";

const { push, timeline, complete } = vi.hoisted(() => {
  const complete = { current: () => {} };
  return {
    push: vi.fn(),
    complete,
    timeline: vi.fn((options: { onComplete: () => void }) => {
      complete.current = options.onComplete;
      return { to: vi.fn().mockReturnThis() };
    }),
  };
});
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} />,
}));
vi.mock("@gsap/react", () => ({
  useGSAP: () => ({ contextSafe: (callback: () => void) => callback }),
}));
vi.mock("gsap", () => ({ default: { timeline, killTweensOf: vi.fn() } }));

const album: Album = {
  name: "테스트 앨범",
  imageSlug: "fixture",
  imgUrl: "https://assets.example.test/fixture.webp",
  color: "#5942bc",
  songs: [{ title: "수록곡", slug: "fixture", youtubeId: "fixture", isTitle: true }],
};
beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

it("앨범 이름과 곡 링크를 유지하고 Escape 중복 요청도 퇴장 완료 후 한 번만 닫는다", async () => {
  const onClose = vi.fn();
  render(<AlbumDetailModal album={album} onClose={onClose} />);
  expect(await screen.findByRole("dialog", { name: album.name })).toBeVisible();
  expect(screen.getByRole("link", { name: /수록곡/ })).toHaveAttribute("href", "/songs/fixture");
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" });
  expect(timeline).toHaveBeenCalledOnce();
  expect(onClose).not.toHaveBeenCalled();
  act(() => complete.current());
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onClose).toHaveBeenCalledOnce();
  expect(push).not.toHaveBeenCalled();
});

it("직접 진입의 닫기 버튼은 퇴장 완료 뒤 기존 홈 push를 유지한다", async () => {
  render(<AlbumDetailModal album={album} />);
  fireEvent.click(await screen.findByRole("button", { name: "앨범 상세 닫기" }));
  expect(push).not.toHaveBeenCalled();
  act(() => complete.current());
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(push).toHaveBeenCalledExactlyOnceWith("/", { scroll: false });
});
