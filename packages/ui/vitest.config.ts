import { defineConfig } from "vitest/config";

import { browserTest } from "@oioi-bwg/config/vitest/browser";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    ...browserTest,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
