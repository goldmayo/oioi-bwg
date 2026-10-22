import path from "node:path";

/** @satisfies {import("vitest/config").TestUserConfig} */
export const browserTest = {
  globals: true,
  environment: "jsdom",
  setupFiles: [path.join(import.meta.dirname, "browser.setup.ts")],
  css: true,
};
