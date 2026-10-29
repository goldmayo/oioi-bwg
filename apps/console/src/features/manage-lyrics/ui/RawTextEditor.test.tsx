import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { RawTextEditor } from "./RawTextEditor";
const { updateLine } = vi.hoisted(() => ({ updateLine: vi.fn() }));
vi.mock("./LyricsEditorContext", () => ({ useLyricsEditorContext: () => ({ updateLine }) }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it.each([false, true])(
  "텍스트 수정은 조각 경계·강조·상대 시각을 보존한다 (추임새 %s)",
  (isExtra) => {
    const line = {
      startTime: 19.75,
      isExtra,
      segments: [
        { text: "앞부분 ", isCheer: false, isEcho: false },
        { text: "응원 부분", isCheer: true, isEcho: true, startTimeOffset: 0.8 },
      ],
    };
    render(<RawTextEditor line={line} lineIndex={5} isOpen onClose={vi.fn()} />);
    expect(
      (screen.getByRole("textbox", { name: "2번째 조각 내용" }) as HTMLInputElement).value,
    ).toBe("응원 부분");
    fireEvent.change(screen.getByRole("textbox", { name: "2번째 조각 내용" }), {
      target: { value: "고친 응원" },
    });
    fireEvent.click(screen.getByRole("button", { name: "저장" }));
    expect(updateLine).toHaveBeenCalledExactlyOnceWith(5, {
      segments: [line.segments[0], { ...line.segments[1], text: "고친 응원" }],
    });
  },
);
