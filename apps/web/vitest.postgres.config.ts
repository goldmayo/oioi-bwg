import path from "node:path";
import { defineProject, mergeConfig } from "vitest/config";

import { createPostgresProject } from "@oioi-bwg/config/vitest/postgres";

const postgresProject = createPostgresProject(path.resolve(import.meta.dirname, "../.."));

export default mergeConfig(
  postgresProject,
  defineProject({
    resolve: {
      alias: {
        "@": path.join(import.meta.dirname, "src"),
      },
    },
    test: {
      name: "web-postgres",
      // 실제 DB 충돌을 Web HTTP adapter의 409 응답까지 검증하는 consumer다.
      include: ["tools/repository/tests/integration/m7-foundation.postgres.test.ts"],
    },
  }),
);
