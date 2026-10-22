import path from "node:path";
import { defineConfig } from "vitest/config";

import { browserTest } from "../../config/vitest/browser";

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "client-only": path.resolve(import.meta.dirname, "../../tests/mocks/client-only.ts"),
      "server-only": path.resolve(import.meta.dirname, "../../tests/mocks/server-only.ts"),
    },
  },
  test: {
    ...browserTest,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
