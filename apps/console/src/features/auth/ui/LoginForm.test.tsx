import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import LoginForm from "./LoginForm";

const { signIn, setupMfa, confirmMfa, replace } = vi.hoisted(() => ({
  signIn: vi.fn(),
  replace: vi.fn(),
  setupMfa: vi.fn(),
  confirmMfa: vi.fn(),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
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
  fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "1" } });
  expect(screen.getByLabelText("인증 코드").getAttribute("aria-invalid")).toBe("false");
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

it.each([false, true])(
  "초기 제한 안내(%s)와 hydration 후 로그인 입력을 보존한다",
  async (initialRateLimited) => {
    signIn.mockResolvedValue({ error: "검증용 로그인 결과" });
    container = document.createElement("div");
    container.innerHTML = renderToString(<LoginForm initialRateLimited={initialRateLimited} />);
    document.body.append(container);
    expect(screen.queryByRole("alert")?.textContent ?? null).toBe(
      initialRateLimited ? "요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요." : null,
    );
    expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("Password") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "다음" }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      root = hydrateRoot(container, <LoginForm initialRateLimited={initialRateLimited} />);
    });
    await waitFor(() =>
      expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(false),
    );
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@p04.example.test" },
    });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "fixture-password" } });
    fireEvent.click(screen.getByRole("button", { name: "다음" }));
    await screen.findByLabelText("인증 코드");
    expect(signIn).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
    fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: "로그인" }));
    await screen.findByText("검증용 로그인 결과");
    expect(signIn).toHaveBeenCalledOnce();
    const submitted = signIn.mock.calls[0][0] as FormData;
    expect(submitted.get("email")).toBe("admin@p04.example.test");
    expect(submitted.get("password")).toBe("fixture-password");
    expect(submitted.get("otp")).toBe("123456");
  },
);

it("성공하면 입력과 오류를 버리고 관리 화면 이동 안내를 유지한다", async () => {
  signIn.mockResolvedValue(undefined);
  render(<LoginForm />);
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByLabelText("인증 코드");
  fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: /^로그인$/ }));
  await screen.findByRole("status");
  expect(replace).toHaveBeenCalledExactlyOnceWith("/admin");
  expect(screen.queryByRole("alert")).toBeNull();
  expect(screen.queryByLabelText("Email")).toBeNull();
  expect(screen.queryByLabelText("Password")).toBeNull();
  expect(screen.queryByLabelText("인증 코드")).toBeNull();
  expect(screen.queryByRole("button", { name: "다음" })).toBeNull();
});

it("입력 전 포커스와 단계 취소만으로 필드 오류를 표시하지 않는다", async () => {
  render(<LoginForm />);
  for (const label of ["Email", "Password"]) {
    fireEvent.focus(screen.getByLabelText(label));
    fireEvent.blur(screen.getByLabelText(label));
    expect(screen.getByLabelText(label).getAttribute("aria-invalid")).toBe("false");
  }
  expect(screen.queryByText("올바른 이메일 형식을 입력해주세요.")).toBeNull();
  expect(screen.queryByText("비밀번호는 최소 6자 이상이어야 합니다.")).toBeNull();
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByLabelText("인증 코드");
  fireEvent.click(screen.getByRole("button", { name: "취소" }));
  fireEvent.focus(screen.getByLabelText("Email"));
  expect(screen.getByLabelText("Email").getAttribute("aria-invalid")).toBe("false");
  expect(screen.getByLabelText("Password").getAttribute("aria-invalid")).toBe("false");
});

it("인증 코드 입력 중에는 오류를 표시하지 않고 제출 후 검증한다", async () => {
  render(<LoginForm />);
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  const otp = await screen.findByLabelText("인증 코드");
  fireEvent.focus(otp);
  fireEvent.change(otp, { target: { value: "1" } });
  fireEvent.blur(otp);
  expect(otp.getAttribute("aria-invalid")).toBe("false");
  expect(screen.queryByText("인증 코드 6자리를 입력해주세요.")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: /^로그인$/ }));
  await screen.findByText("인증 코드 6자리를 입력해주세요.");
  expect(otp.getAttribute("aria-invalid")).toBe("true");
  expect(signIn).not.toHaveBeenCalled();
  fireEvent.change(otp, { target: { value: "123456" } });
  await waitFor(() => expect(otp.getAttribute("aria-invalid")).toBe("false"));
});

it("CLI 연결에서 로그인하면 고정된 승인 화면으로 돌아간다", async () => {
  signIn.mockResolvedValue(undefined);
  render(<LoginForm destination="operator" />);
  fillCredentials();
  fireEvent.click(screen.getByRole("button", { name: "다음" }));
  await screen.findByLabelText("인증 코드");
  fireEvent.change(screen.getByLabelText("인증 코드"), { target: { value: "123456" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/operator-connect"));
  expect(screen.getByRole("status").textContent).toContain("CLI 연결 승인 화면");
});
