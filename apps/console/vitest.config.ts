import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "client-only": path.resolve(import.meta.dirname, "../../tests/mocks/client-only.ts"),
      "server-only": path.resolve(import.meta.dirname, "../../tests/mocks/server-only.ts"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "../../vitest.setup.ts",
    include: ["src/**/*.test.{ts,tsx}"],
    css: true,
  },
});
