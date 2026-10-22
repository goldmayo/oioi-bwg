import path from "node:path";
import type { TestUserConfig } from "vitest/config";

export const browserTest = {
  globals: true,
  environment: "jsdom",
  setupFiles: [path.join(import.meta.dirname, "browser.setup.ts")],
  css: true,
} satisfies TestUserConfig;
