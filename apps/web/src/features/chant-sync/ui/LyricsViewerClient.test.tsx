import { useEffect } from "react";
import type { PublishedCheerGuide } from "@oioi-bwg/contracts/song";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { LyricsViewerClient } from "./LyricsViewerClient";

const life = vi.hoisted(() => ({
  created: vi.fn(),
  destroyed: vi.fn(),
  seek: vi.fn(),
  toast: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@gsap/react", () => ({ useGSAP: () => undefined }));
vi.mock("@/shared/model/useAdWatcher", () => ({ useAdWatcher: () => false }));
vi.mock("sonner", () => ({ toast: Object.assign(life.toast, { error: life.error }) }));
vi.mock("@/shared/ui/YouTubePlayer", () => ({
  YouTubePlayer: ({ onPlayerReady }: { onPlayerReady: (player: unknown) => void }) => {
    useEffect(() => {
      life.created();
      onPlayerReady({ getCurrentTime: () => 3.2, seekTo: life.seek });
      return () => {
        life.destroyed();
      };
    }, [onPlayerReady]);
    return <div data-testid="player" />;
  },
}));
const lyrics = (text: string) => [
  { startTime: 1, isExtra: false, segments: [{ text, isCheer: true, isEcho: false }] },
];
const guides: PublishedCheerGuide[] = [
  {
    id: "019a0170-0000-7000-8000-000000000001",
    mode: "CONCERT",
    sourceType: "FANDOM",
    sourceUrl: null,
    guideVideoUrl: null,
    description: null,
    lyrics: lyrics("콘서트 응원"),
  },
  {
    id: "019a0170-0000-7000-8000-000000000002",
    mode: "FESTIVAL",
    sourceType: "OFFICIAL",
    sourceUrl: "https://example.invalid/official",
    guideVideoUrl: "https://youtu.be/guide",
    description: null,
    lyrics: lyrics("페스티벌 응원"),
  },
];
const writeText = vi.fn();
const album = { name: "앨범", imageSlug: "album", imgUrl: "", color: "#000000", songs: [] };
function view(cheerGuides: PublishedCheerGuide[] | undefined = guides, searchParams = "") {
  const onUrlUpdate = vi.fn();
  render(
    <NuqsTestingAdapter
      hasMemory
      resetUrlUpdateQueueOnMount={false}
      searchParams={searchParams}
      onUrlUpdate={onUrlUpdate}
    >
      <LyricsViewerClient
        album={album}
        song={{
          id: guides[0].id,
          title: "곡",
          youtubeId: "video",
          lyrics: lyrics("과거 응원"),
          cheerGuides,
        }}
      />
    </NuqsTestingAdapter>,
  );
  return onUrlUpdate;
}
beforeEach(() => {
  vi.clearAllMocks();
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
  window.history.replaceState({}, "", "/songs/preview?keep=1");
});
afterEach(() => cleanup());

it("모드·출처·URL을 바꾸면서 재생기와 현재 시각을 유지하고 선택한 링크를 복사한다", async () => {
  const onUrlUpdate = view();
  const player = screen.getByTestId("player");
  expect(screen.getByText("콘서트 응원")).toBeInTheDocument();
  expect(screen.getByText("팬덤", { exact: true })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("radio", { name: "페스티벌" }));
  await screen.findByText("페스티벌 응원");
  expect(screen.getByText("공식", { exact: true })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "공식 응원법 원본 보기" })).toHaveAttribute(
    "href",
    guides[1].sourceUrl,
  );
  expect(screen.getByRole("link", { name: "응원법 영상 보기" })).toBeInTheDocument();
  await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
  expect(onUrlUpdate.mock.calls.at(-1)![0].searchParams.get("guide")).toBe(guides[1].id);
  expect(screen.getByTestId("player")).toBe(player);
  expect(life.created).toHaveBeenCalledOnce();
  expect(life.destroyed).not.toHaveBeenCalled();
  expect(life.seek).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "페스티벌 응원" }));
  expect(life.seek).toHaveBeenCalledWith(1, true);
  expect(screen.getByRole("button", { name: "페스티벌 응원" })).toHaveAttribute(
    "aria-current",
    "true",
  );
  fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
  await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  const copied = new URL(writeText.mock.calls[0][0]);
  expect(copied.searchParams.get("guide")).toBe(guides[1].id);
  expect(copied.searchParams.get("keep")).toBe("1");
  expect(life.toast).toHaveBeenCalledWith("응원법 링크를 복사했어요.");
});
it.each(["invalid", "019a0170-0000-7000-8000-000000000099"])(
  "잘못된·다른 곡·미공개 ID %s는 기본 응원법으로 정규화한다",
  async (id) => {
    const update = view(guides, `?guide=${id}&keep=1`);
    expect(screen.getByText("콘서트 응원")).toBeInTheDocument();
    await waitFor(() => expect(update).toHaveBeenCalled());
    expect(update.mock.calls.at(-1)![0].searchParams.get("guide")).toBeNull();
    expect(update.mock.calls.at(-1)![0].searchParams.get("keep")).toBe("1");
  },
);
it("공개 항목이 하나면 선택기를 숨기고 공유 URL의 선택을 읽는다", () => {
  view([guides[1]], `?guide=${guides[1].id}`);
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.getByText("페스티벌 응원")).toBeInTheDocument();
});
it("공개 항목이 0개면 예전 본문을 다시 표시하지 않는다", () => {
  view([]);
  expect(screen.queryByText("과거 응원")).not.toBeInTheDocument();
  expect(screen.getByText("아직 공개된 응원법이 없어요.")).toBeInTheDocument();
});
it("복사가 실패하면 선택을 보존하고 재시도 안내를 표시한다", async () => {
  writeText.mockRejectedValueOnce(new Error("denied"));
  view(guides, `?guide=${guides[1].id}`);
  fireEvent.click(screen.getByRole("button", { name: "링크 복사" }));
  await waitFor(() =>
    expect(life.error).toHaveBeenCalledWith("링크를 복사하지 못했어요. 다시 시도해 주세요."),
  );
  expect(screen.getByRole("radio", { name: "페스티벌" })).toBeChecked();
});

it("이관 전 곡은 기존 가사를 유지하고 출처를 임의 표시하지 않는다", () => {
  render(
    <NuqsTestingAdapter resetUrlUpdateQueueOnMount={false}>
      <LyricsViewerClient
        song={{ id: guides[0].id, title: "곡", youtubeId: "video", lyrics: lyrics("기존 가사") }}
      />
    </NuqsTestingAdapter>,
  );
  expect(screen.getByText("기존 가사")).toBeInTheDocument();
  expect(screen.queryByRole("radio")).not.toBeInTheDocument();
  expect(screen.queryByText("팬덤", { exact: true })).not.toBeInTheDocument();
});
