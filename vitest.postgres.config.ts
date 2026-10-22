import { configDefaults, defineConfig } from "vitest/config";

import { postgresProject } from "./config/vitest/postgres";

export default defineConfig({
  root: import.meta.dirname,
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    projects: [
      {
        ...postgresProject,
        test: {
          ...postgresProject.test,
          name: "server-postgres",
          include: ["tests/integration/*.postgres.test.ts"],
          exclude: [...configDefaults.exclude, "tests/integration/m7-foundation.postgres.test.ts"],
        },
      },
      {
        extends: "./apps/web/vitest.postgres.config.ts",
        root: import.meta.dirname,
      },
    ],
  },
});
