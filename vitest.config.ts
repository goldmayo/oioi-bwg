import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // TEST-02에서 workspace 전체로 확대하기 전까지 기존 Web 실행 범위를 유지한다.
    projects: ["apps/web/vitest.config.ts"],
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
