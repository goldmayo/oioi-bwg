import { expect, it } from "vitest";

import { consoleSessionCallbacks as callbacks, hasConsoleMfaProof } from "./console-session";

it("issues only server MFA claims and preserves them across client session.update", () => {
  const proof = { mfaVerified: true, mfaVersion: 7 };
  const initial = callbacks.jwt({
    token: {},
    user: { id: "42", ...proof, role: "ADMIN" },
    trigger: "signIn",
  } as never);
  expect(initial).toEqual({ sub: "42", ...proof });
  expect(
    callbacks.jwt({
      token: initial,
      trigger: "update",
      session: { sub: "99", mfaVersion: 100, mfaVerified: true },
    } as never),
  ).toEqual(initial);
  const session = callbacks.session({
    session: { user: {}, expires: "expiry" },
    token: initial,
  } as never);
  expect(session.user).toEqual({ id: "42", ...proof });
  expect(
    callbacks.jwt({ token: { sub: "42" }, trigger: "update", session: proof } as never),
  ).toEqual({ sub: "42" });
  expect(callbacks.jwt({ token: {}, user: { id: "42" }, trigger: "signIn" } as never)).toBeNull();
});

it.each([undefined, null, 0, -1, 1.5, "1", 2_147_483_648])(
  "rejects invalid version %s",
  (version) => {
    expect(hasConsoleMfaProof({ mfaVerified: true, mfaVersion: version })).toBe(false);
  },
);
