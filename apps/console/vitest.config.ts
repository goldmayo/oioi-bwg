import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

import { browserTest } from "@oioi-bwg/config/vitest/browser";

export default defineConfig({
  root: import.meta.dirname,
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "client-only": fileURLToPath(import.meta.resolve("@oioi-bwg/config/vitest/client-only")),
      "server-only": fileURLToPath(import.meta.resolve("@oioi-bwg/config/vitest/server-only")),
    },
  },
  test: {
    ...browserTest,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
