import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      "server-only": fileURLToPath(import.meta.resolve("@oioi-bwg/config/vitest/server-only")),
    },
  },
  test: { globals: true, environment: "node", include: ["src/**/*.test.ts"] },
});
