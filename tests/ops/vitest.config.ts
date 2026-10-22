import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: path.resolve(import.meta.dirname, "../.."),
  test: {
    environment: "node",
    include: ["tests/ops/**/*.test.ts"],
    testTimeout: 15_000,
  },
});
