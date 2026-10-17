import type { NextAuthConfig } from "next-auth";

type ConsoleMfaProof = { mfaVerified: true; mfaVersion: number };

export function hasConsoleMfaProof<T>(value: T): value is T & ConsoleMfaProof {
  if (!value || typeof value !== "object") return false;
  const proof = value as { mfaVerified?: unknown; mfaVersion?: unknown };
  return (
    proof.mfaVerified === true &&
    typeof proof.mfaVersion === "number" &&
    Number.isInteger(proof.mfaVersion) &&
    proof.mfaVersion > 0 &&
    proof.mfaVersion <= 2_147_483_647
  );
}

export const consoleSessionCallbacks = {
  jwt({ token, user, trigger }) {
    // user는 서버 authorize의 초기 결과만 사용한다. update의 client session은 읽지 않는다.
    if (trigger === "signIn" && user) {
      return user.id && hasConsoleMfaProof(user)
        ? { sub: user.id, mfaVerified: true as const, mfaVersion: user.mfaVersion }
        : null;
    }
    return {
      sub: token.sub,
      ...(hasConsoleMfaProof(token)
        ? { mfaVerified: true as const, mfaVersion: token.mfaVersion }
        : {}),
    };
  },
  session({ session, token }) {
    session.user.id = token.sub ?? "";
    session.user.mfaVerified = hasConsoleMfaProof(token) ? true : undefined;
    session.user.mfaVersion = hasConsoleMfaProof(token) ? token.mfaVersion : undefined;
    return session;
  },
} satisfies NonNullable<NextAuthConfig["callbacks"]>;
