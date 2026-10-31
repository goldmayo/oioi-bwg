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

/** 브라우저 승인으로 연결하는 로컬 운영 도구는 명시적으로 활성화한다. */
export function isConsoleOperatorEnabled(env: ConsoleEnvironment = process.env) {
  return env.CONSOLE_OPERATOR_ENABLED === "true";
}

/** 이용 범위 확인 후 운영자가 주입한다. 누락·목록 오타는 전체 거절한다. */
export function getWaveformGenerationConfig(env: ConsoleEnvironment = process.env) {
  const ids = (env.CONSOLE_WAVEFORM_ALLOWED_VIDEO_IDS ?? "").split(",");
  return {
    enabled:
      env.CONSOLE_WAVEFORM_GENERATION_ENABLED === "true" &&
      env.CONSOLE_WAVEFORM_RUNNER_ENABLED === "true",
    allowedVideoIds: ids.every((id) => /^[A-Za-z0-9_-]{11}$/.test(id)) ? ids : [],
  };
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
