import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

import { createPostgresProject } from "@oioi-bwg/config/vitest/postgres";

const root = path.resolve(import.meta.dirname, "../..");
const postgresProject = createPostgresProject(root);

export default defineConfig({
  root,
  test: {
    fileParallelism: false,
    maxWorkers: 1,
    projects: [
      {
        ...postgresProject,
        test: {
          ...postgresProject.test,
          name: "server-postgres",
          include: [
            "tools/repository/tests/integration/*.postgres.test.ts",
            "packages/server/tests/integration/*.postgres.test.ts",
          ],
          exclude: [
            ...configDefaults.exclude,
            "tools/repository/tests/integration/m7-foundation.postgres.test.ts",
          ],
        },
      },
      {
        extends: path.join(root, "apps/web/vitest.postgres.config.ts"),
        root,
      },
    ],
  },
});
