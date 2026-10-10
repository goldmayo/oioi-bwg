import { AppError } from "@oioi-bwg/server/errors/app-error";
import { headers } from "next/headers";
import NextAuth, { AuthError, CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { authenticateConsole } from "@/server/auth/authenticate-console";
import { ConsoleMfaRateLimited, reserveConsoleMfaAttempt } from "@/server/auth/console-mfa-limiter";
import { consoleSessionCallbacks } from "@/server/auth/console-session";
import { assertConsoleOrigin } from "@/server/http/console-origin";
import { reportAuthError } from "@/server/observability/auth-error-reporter";

import { consoleCookies, getConsoleRuntimeConfig } from "@/shared/config/console-runtime";

export class LoginRateLimited extends CredentialsSignin {
  code = "rate_limited";
  constructor(readonly retryAfterSeconds: number) {
    super();
  }
}

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
  otp: z.string().regex(/^\d{6}$/),
});

const {
  auth,
  handlers,
  signIn: authSignIn,
  signOut: authSignOut,
} = NextAuth(() => {
  const config = getConsoleRuntimeConfig();
  return {
    secret: config.secret,
    trustHost: true,
    cookies: consoleCookies,
    pages: { signIn: "/admin-login" },
    logger: { error: reportAuthError },
    providers: [
      Credentials({
        credentials: {
          email: { label: "Email", type: "email" },
          password: { label: "Password", type: "password" },
          otp: { label: "OTP", type: "text" },
        },
        async authorize(credentials) {
          const parsed = credentialsSchema.safeParse(credentials);
          if (!parsed.success) return null;

          const refund = await reserveConsoleMfaAttempt(parsed.data.email).catch(
            (error: unknown) => {
              if (error instanceof ConsoleMfaRateLimited)
                throw new LoginRateLimited(error.retryAfterSeconds);
              throw error;
            },
          );
          const identity = await authenticateConsole(
            parsed.data.email,
            parsed.data.password,
            parsed.data.otp,
          );
          if (identity) await refund();
          return identity;
        },
      }),
    ],
    session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
    callbacks: {
      ...consoleSessionCallbacks,
      redirect({ url }) {
        const target = new URL(url, config.origin);
        return target.origin === config.origin ? target.href : config.origin;
      },
    },
  };
});

export { auth, handlers };

/** 기존 feature Action은 FormData만 전달하고 request/Auth.js 경계는 이 adapter가 소유한다. */
export async function signIn(formData: FormData) {
  try {
    assertConsoleOrigin(await headers());
    formData.set("redirectTo", "/admin");
    await authSignIn("credentials", formData);
  } catch (error) {
    if (error instanceof LoginRateLimited) {
      return {
        error: "요청 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.",
        code: "RATE_LIMITED",
        retryAfterSeconds: error.retryAfterSeconds,
      };
    }
    if (error instanceof AppError && error.code === "FORBIDDEN")
      return { error: "요청 출처를 확인할 수 없습니다." };
    if (error instanceof AuthError && error.type === "CredentialsSignin")
      return { error: "이메일 또는 비밀번호를 확인해주세요." };
    throw error;
  }
}

export async function signOut() {
  assertConsoleOrigin(await headers());
  await authSignOut({ redirectTo: "/admin-login" });
}
