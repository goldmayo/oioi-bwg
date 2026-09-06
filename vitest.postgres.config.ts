import path from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "server-only": path.resolve(__dirname, "./tests/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    fileParallelism: false,
    hookTimeout: 30_000,
    include: ["tests/integration/m7-foundation.postgres.test.ts"],
    maxWorkers: 1,
    sequence: { concurrent: false },
    testTimeout: 30_000,
  },
});
