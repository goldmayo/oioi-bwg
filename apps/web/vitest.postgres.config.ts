import path from "node:path";
import { defineProject, mergeConfig } from "vitest/config";

import { postgresProject } from "../../config/vitest/postgres";

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
      include: ["tests/integration/m7-foundation.postgres.test.ts"],
    },
  }),
);
