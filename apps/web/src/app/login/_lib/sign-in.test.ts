import { expect, test, vi } from "vitest";

const signIn = vi.hoisted(() => vi.fn());
vi.mock("next-auth/react", () => ({ signIn }));
import { signInWithPassword } from "./sign-in";

test("ordinary Web login uses the Auth.js credentials endpoint with a fixed home destination", async () => {
  signIn.mockResolvedValue({ ok: true, error: undefined, url: "/" });
  await signInWithPassword("user@example.test", "fixture-password");
  expect(signIn).toHaveBeenCalledWith("credentials", {
    email: "user@example.test",
    password: "fixture-password",
    redirect: false,
    redirectTo: "/",
  });
});
