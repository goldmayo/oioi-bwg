import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: ["apps/*/vitest.config.ts", "packages/*/vitest.config.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "apps/web/src/shared/hooks/**/*.{ts,tsx}",
        "apps/web/src/shared/utils/**/*.{ts,tsx}",
        "apps/web/src/features/**/use*.{ts,tsx}",
      ],
      exclude: ["**/*.test.{ts,tsx}", "**/*.d.ts"],
    },
  },
});
