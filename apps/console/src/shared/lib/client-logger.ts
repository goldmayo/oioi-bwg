"use client";

type ConsoleMethod = "debug" | "error" | "info" | "warn";

function write(method: ConsoleMethod, message: string): void {
  if (process.env.NEXT_PUBLIC_APP_ENV !== "local") return;
  console[method](message);
}

/** local browser diagnostics 전용 logger. Sentry error tracking과 독립적으로 동작한다. */
export const clientLogger = {
  debug: (message: string) => write("debug", message),
  info: (message: string) => write("info", message),
  warn: (message: string) => write("warn", message),
  error: (message: string) => write("error", message),
};
