import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

import { MobilePaintEditor } from "./MobilePaintEditor";
const { updateLine } = vi.hoisted(() => ({ updateLine: vi.fn() }));
vi.mock("./LyricsEditorContext", () => ({ useLyricsEditorContext: () => ({ updateLine }) }));
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
