import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import LoginForm from "./LoginForm";

const { signIn, setupMfa, confirmMfa } = vi.hoisted(() => ({
  signIn: vi.fn(),
  setupMfa: vi.fn(),
  confirmMfa: vi.fn(),
}));
vi.mock("../api/actions", () => ({ signIn }));
vi.mock("../api/api", () => ({ setupMfa, confirmMfa }));
let root: Root | undefined;
let container: HTMLDivElement;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  container?.remove();
  vi.resetAllMocks();
});

function fillCredentials() {
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@p04.example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "fixture-password" } });
}

it("등록 confirmation은 저장 version을 사용하며 완료 후 QR과 입력을 버린다", async () => {
  setupMfa.mockResolvedValue({ qrDataUrl: "data:image/png;base64,fixture", version: 7 });
  confirmMfa.mockResolvedValue({ version: 7 });
  render(<LoginForm enrollmentEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "인증기 등록" }));
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "QR 생성" }));
  await screen.findByAltText("인증기 등록 QR 코드");
  fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "등록 확인" }));
  await screen.findByText("다음 코드로 로그인하세요. 비밀번호를 다시 입력해주세요.");
  expect(confirmMfa.mock.calls[0][0]).toEqual({
    email: "admin@p04.example.test",
    password: "fixture-password",
    otp: "123456",
    version: 7,
  });
  expect(signIn).not.toHaveBeenCalled();
  expect(screen.queryByAltText("인증기 등록 QR 코드")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "로그인으로 돌아가기" }));
  expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
});

it("이탈로 중단한 setup 응답이 늦게 도착해도 QR을 복원하지 않는다", async () => {
  let finish!: (value: { qrDataUrl: string; version: number }) => void;
  setupMfa.mockReturnValue(
    new Promise((resolve) => {
      finish = resolve;
    }),
  );
  render(<LoginForm enrollmentEnabled />);
  fireEvent.click(screen.getByRole("button", { name: "인증기 등록" }));
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "QR 생성" }));
  await waitFor(() => expect(setupMfa).toHaveBeenCalledOnce());
  fireEvent(window, new Event("pagehide"));
  expect((setupMfa.mock.calls[0][1] as AbortSignal).aborted).toBe(true);
  await act(async () => {
    finish({ qrDataUrl: "data:image/png;base64,late", version: 7 });
  });
  expect(screen.queryByAltText("인증기 등록 QR 코드")).toBeNull();
  expect((screen.getByLabelText("Email") as HTMLInputElement).value).toBe("");
  expect((screen.getByLabelText("Password") as HTMLInputElement).value).toBe("");
});

it("로그인 제한 안내를 표시하고 제출한 OTP를 지운다", async () => {
  signIn.mockResolvedValue({ error: "잠시 후 다시 시도해주세요.", retryAfterSeconds: 42 });
  render(<LoginForm />);
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByLabelText("인증 코드");
  fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await screen.findByText("잠시 후 다시 시도해주세요. 42초 후 다시 시도해주세요.");
  expect((screen.getByLabelText("인증 코드") as HTMLInputElement).value).toBe("");
});

it("enables login only after hydration and submits the entered credentials", async () => {
  signIn.mockResolvedValue({ error: "검증용 로그인 결과" });
  container = document.createElement("div");
  container.innerHTML = renderToString(<LoginForm />);
  document.body.append(container);
  expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText("Password") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => {
    root = hydrateRoot(container, <LoginForm />);
  });
  await waitFor(() =>
    expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@p04.example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "fixture-password" } });
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByLabelText("인증 코드");
  expect(signIn).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await screen.findByText("검증용 로그인 결과");
  expect(signIn).toHaveBeenCalledOnce();
  const submitted = signIn.mock.calls[0][0] as FormData;
  expect(submitted.get("email")).toBe("admin@p04.example.test");
  expect(submitted.get("password")).toBe("fixture-password");
  expect(submitted.get("otp")).toBe("123456");
});
