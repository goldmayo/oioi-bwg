import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { MobilePaintEditor } from "./MobilePaintEditor";
const { updateLine } = vi.hoisted(() => ({ updateLine: vi.fn() }));
vi.mock("./LyricsEditorContext", () => ({ useLyricsEditorContext: () => ({ updateLine }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it("글자 편집을 열고 그대로 완료해도 복합 응원·에코와 상대 시각을 보존한다", () => {
  const line = {
    startTime: 3,
    isExtra: true,
    segments: [
      { text: "응원", isCheer: true, isEcho: false, startTimeOffset: 0 },
      { text: "에코", isCheer: true, isEcho: true, startTimeOffset: 0.5 },
    ],
  };
  render(<MobilePaintEditor line={line} lineIndex={0} isOpen={true} onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "완료" }));
  expect(updateLine).toHaveBeenCalledWith(0, { segments: line.segments });
});

it("강조를 바꿔 나뉜 추임새 조각 모두 원래의 offset을 유지한다", () => {
  const line = {
    startTime: 4,
    isExtra: true,
    segments: [{ text: "어이! ", isCheer: true, isEcho: false, startTimeOffset: 0.8 }],
  };
  render(<MobilePaintEditor line={line} lineIndex={1} isOpen onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "에코" }));
  fireEvent.pointerDown(document.querySelector('[data-char-idx="1"]')!);
  fireEvent.pointerUp(document.querySelector('[data-char-idx="1"]')!);
  fireEvent.click(screen.getByRole("button", { name: "완료" }));
  const segments = updateLine.mock.calls.at(-1)![1].segments;
  expect(segments.map((segment: { startTimeOffset: number }) => segment.startTimeOffset)).toEqual([
    0.8, 0.8, 0.8,
  ]);
  expect(segments.map((segment: { text: string }) => segment.text).join("")).toBe("어이! ");
  expect(segments[1]).toMatchObject({ isCheer: true, isEcho: true });
});
it("동일한 강조의 인접한 원본 조각도 무변경 완료 시 경계를 보존한다", () => {
  const line = {
    startTime: 1,
    isExtra: false,
    segments: [
      { text: "앞", isCheer: false, isEcho: false },
      { text: "뒤", isCheer: false, isEcho: false },
    ],
  };
  render(<MobilePaintEditor line={line} lineIndex={0} isOpen onClose={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: "완료" }));
  expect(updateLine.mock.calls.at(-1)![1].segments).toEqual(line.segments);
});
