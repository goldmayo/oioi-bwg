import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import GlobalError from "./global-error";

const capture = vi.hoisted(() => vi.fn());
vi.mock("@/shared/api/capture-client-error", () => ({ captureClientErrorOnce: capture }));

afterEach(() => {
  cleanup();
  document.querySelectorAll("iframe").forEach((frame) => frame.remove());
  vi.clearAllMocks();
});

it("전역 오류에서 provider 없이 Next 재시도를 호출하고 digest를 관측한다", () => {
  const retry = vi.fn();
  const error = Object.assign(new Error("일시적 렌더 실패"), { digest: "local-recovery" });
  const frame = document.createElement("iframe");
  document.body.append(frame);
  const view = render(<GlobalError error={error} retry={retry} />, {
    container: frame.contentDocument ?? undefined,
  });
  fireEvent.click(view.getByRole("button", { name: "다시 시도하기" }));
  expect(retry).toHaveBeenCalledOnce();
  expect(capture).toHaveBeenCalledExactlyOnceWith(error, {
    source: "global-error-boundary",
    outcome: "error_boundary_mounted",
    digest: "local-recovery",
  });
});
