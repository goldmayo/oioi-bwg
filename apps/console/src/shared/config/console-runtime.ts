interface ConsoleEnvironment {
  [key: string]: string | undefined;
  CONSOLE_ORIGIN?: string;
  CONSOLE_AUTH_SECRET?: string;
  AUTH_SECRET?: string;
}

/** 설정한 HTTPS origin 또는 비공개 개발용 HTTP loopback만 허용한다. */
export function getConsoleOrigin(env: ConsoleEnvironment = process.env) {
  const value = env.CONSOLE_ORIGIN ?? "http://127.0.0.1:3001";
  const origin = new URL(value);
  if (
    (origin.protocol !== "https:" &&
      !(
        origin.protocol === "http:" && ["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname)
      )) ||
    ![origin.origin, `${origin.origin}/`].includes(value) ||
    origin.port === "0" ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  ) {
    throw new Error("Console requires an explicit HTTPS or loopback HTTP origin");
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

/** 공개 전 제한된 등록만 명시적으로 열며 오타/누락은 닫힘으로 처리한다. */
export function isConsoleMfaEnrollmentEnabled(env: ConsoleEnvironment = process.env) {
  return env.CONSOLE_MFA_ENROLLMENT_ENABLED === "true";
}

export function getConsoleCookies(origin: string) {
  const secure = new URL(origin).protocol === "https:";
  return {
    sessionToken: {
      name: "oioi-console.session-token",
      options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure },
    },
    csrfToken: {
      name: "oioi-console.csrf-token",
      options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure },
    },
    callbackUrl: {
      name: "oioi-console.callback-url",
      options: { httpOnly: true, sameSite: "lax" as const, path: "/", secure },
    },
  };
}
