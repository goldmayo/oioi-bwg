import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "server-only": path.resolve(import.meta.dirname, "../../tests/mocks/server-only.ts") },
  },
  test: { globals: true, environment: "node", include: ["src/**/*.test.ts"] },
});
