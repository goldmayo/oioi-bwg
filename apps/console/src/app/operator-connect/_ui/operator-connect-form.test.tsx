import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ApiError } from "@/shared/api/http-errors";

import { OperatorConnectForm } from "./operator-connect-form";
const mocks = vi.hoisted(() => ({ post: vi.fn(), report: vi.fn() }));
vi.mock("@/shared/api/http-client", () => ({ http: { post: mocks.post } }));
vi.mock("@/shared/api/capture-client-error", () => ({ captureClientErrorOnce: mocks.report }));
afterEach(() => vi.resetAllMocks());
function enter(code = "abcd-2345") {
  fireEvent.change(screen.getByLabelText("연결 코드"), { target: { value: code } });
  fireEvent.click(screen.getByRole("button", { name: "연결 승인" }));
}
it("invalid 코드를 제출하지 않고 정상 코드는 정규화하며 완료 후 입력을 버린다", async () => {
  mocks.post.mockResolvedValue({ approved: true });
  render(<OperatorConnectForm />);
  enter("123");
  await screen.findByRole("alert");
  expect(mocks.post).not.toHaveBeenCalled();
  enter();
  await screen.findByRole("status");
  expect(mocks.post).toHaveBeenCalledWith(
    "/api/operator/auth/approve",
    expect.objectContaining({ json: { userCode: "ABCD-2345" }, cache: "no-store" }),
  );
  expect(screen.queryByLabelText("연결 코드")).toBeNull();
});
it("중복 제출을 막고 이탈 시 요청을 취소한다", async () => {
  let finish!: (value: unknown) => void;
  mocks.post.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  const view = render(<OperatorConnectForm />);
  enter();
  await waitFor(() => expect(mocks.post).toHaveBeenCalledOnce());
  expect((screen.getByRole("button", { name: "승인 중..." }) as HTMLButtonElement).disabled).toBe(
    true,
  );
  const signal = mocks.post.mock.calls[0][1].signal as AbortSignal;
  view.unmount();
  expect(signal.aborted).toBe(true);
  await act(async () => finish({ approved: true }));
  expect(mocks.report).not.toHaveBeenCalled();
});
it("요청 제한은 대기 시간을 안내하며 입력을 보존하고 재시도할 수 있다", async () => {
  mocks.post.mockRejectedValueOnce(
    new ApiError(
      429,
      { code: "OPERATOR_RATE_LIMITED", message: "잠시 후 다시 시도해 주세요." },
      17,
    ),
  );
  render(<OperatorConnectForm />);
  enter();
  expect((await screen.findByRole("alert")).textContent).toContain("17초");
  expect((screen.getByLabelText("연결 코드") as HTMLInputElement).value).toBe("abcd-2345");
  mocks.post.mockResolvedValueOnce({ approved: true });
  fireEvent.click(screen.getByRole("button", { name: "연결 승인" }));
  await screen.findByRole("status");
  expect(mocks.report).not.toHaveBeenCalled();
});
it("깨진 응답은 원문 대신 고정 오류만 보고하고 CLI 확인을 안내한다", async () => {
  mocks.post.mockResolvedValue({ approved: true, secret: "private-token" });
  render(<OperatorConnectForm />);
  enter();
  expect((await screen.findByRole("alert")).textContent).toContain("CLI 상태");
  expect(mocks.report.mock.calls[0][0].message).toBe("Operator approval request failed");
  expect(document.body.textContent).not.toContain("private-token");
});

it("hydration 전에는 코드를 입력·제출할 수 없고 native GET 경로도 만들지 않는다", () => {
  const container = document.createElement("div");
  container.innerHTML = renderToString(<OperatorConnectForm />);
  const input = container.querySelector("input")!;
  const button = container.querySelector("button")!;
  expect(input.disabled).toBe(true);
  expect(button.disabled).toBe(true);
  expect(container.querySelector("form")!.method).toBe("post");
});
