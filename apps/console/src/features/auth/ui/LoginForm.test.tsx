import { hydrateRoot, type Root } from "react-dom/client";
import { renderToString } from "react-dom/server";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import LoginForm from "./LoginForm";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("../api/actions", () => ({ signIn }));
let root: Root | undefined;
let container: HTMLDivElement;

afterEach(() => {
  if (root) act(() => root?.unmount());
  root = undefined;
  container?.remove();
});

it("enables login only after hydration and submits the entered credentials", async () => {
  signIn.mockResolvedValue({ error: "검증용 로그인 결과" });
  container = document.createElement("div");
  container.innerHTML = renderToString(<LoginForm />);
  document.body.append(container);
  expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByLabelText("Password") as HTMLInputElement).disabled).toBe(true);
  expect((screen.getByRole("button", { name: "로그인" }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => {
    root = hydrateRoot(container, <LoginForm />);
  });
  await waitFor(() =>
    expect((screen.getByLabelText("Email") as HTMLInputElement).disabled).toBe(false),
  );
  fireEvent.change(screen.getByLabelText("Email"), { target: { value: "admin@p04.example.test" } });
  fireEvent.change(screen.getByLabelText("Password"), { target: { value: "fixture-password" } });
  fireEvent.click(screen.getByRole("button", { name: "로그인" }));
  await screen.findByText("검증용 로그인 결과");
  expect(signIn).toHaveBeenCalledOnce();
  const submitted = signIn.mock.calls[0][0] as FormData;
  expect(submitted.get("email")).toBe("admin@p04.example.test");
  expect(submitted.get("password")).toBe("fixture-password");
});
