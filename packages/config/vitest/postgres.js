import { fileURLToPath } from "node:url";

/** @param {string} root */
export function createPostgresProject(root) {
  /** @satisfies {import("vitest/config").TestProjectConfiguration} */
  const project = {
    root,
    resolve: {
      alias: {
        "server-only": fileURLToPath(new URL("./server-only.ts", import.meta.url)),
      },
    },
    test: {
      environment: "node",
      hookTimeout: 30_000,
      sequence: { concurrent: false },
      testTimeout: 30_000,
    },
  };
  return project;
}
