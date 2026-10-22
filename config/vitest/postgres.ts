import path from "node:path";
import { defineProject } from "vitest/config";

export const postgresProject = defineProject({
  root: path.resolve(import.meta.dirname, "../.."),
  resolve: {
    alias: {
      "server-only": path.resolve(import.meta.dirname, "../../tests/mocks/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    hookTimeout: 30_000,
    sequence: { concurrent: false },
    testTimeout: 30_000,
  },
});
