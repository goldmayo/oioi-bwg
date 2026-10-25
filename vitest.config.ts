import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*/vitest.config.ts", "packages/*/vitest.config.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["apps/*/src/**/*.{ts,tsx,mts}", "packages/*/src/**/*.{ts,tsx,mts}"],
      exclude: ["**/*.test.{ts,tsx,mts}", "**/*.d.ts"],
    },
  },
});
