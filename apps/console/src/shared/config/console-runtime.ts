interface ConsoleEnvironment {
  [key: string]: string | undefined;
  CONSOLE_ORIGIN?: string;
  CONSOLE_AUTH_SECRET?: string;
  AUTH_SECRET?: string;
}

/** P04의 비공개 로컬 실행 계약. 공개 hostname 허용은 MFA가 완성된 P05/P06에서 전환한다. */
export function getConsoleOrigin(env: ConsoleEnvironment = process.env) {
  const origin = new URL(env.CONSOLE_ORIGIN ?? "http://127.0.0.1:3001");
  if (
    origin.protocol !== "http:" ||
    !["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("P04 Console requires a loopback HTTP origin");
  }
  return origin.origin;
}

export function getConsoleRuntimeConfig(env: ConsoleEnvironment = process.env) {
  const origin = getConsoleOrigin(env);
  const secret = env.CONSOLE_AUTH_SECRET;
  if (!secret || secret.length < 32 || secret === env.AUTH_SECRET) {
    throw new Error("Console requires its own CONSOLE_AUTH_SECRET of at least 32 characters");
  }
  return { origin, secret };
}

export const consoleCookies = {
  sessionToken: {
    name: "oioi-console.session-token",
    options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
  },
  csrfToken: {
    name: "oioi-console.csrf-token",
    options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
  },
  callbackUrl: {
    name: "oioi-console.callback-url",
    options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure: false },
  },
};
