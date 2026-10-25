import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { transformSync } from "@babel/core";
import compiler from "babel-plugin-react-compiler";

import { browserTest } from "@oioi-bwg/config/vitest/browser";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    {
      name: "table-react-compiler-regression",
      enforce: "pre",
      transform(code, id) {
        if (
          !/\/(?:AlbumManagerTable|SongManagerTable)\.tsx$|\/packages\/ui\/src\/data-table\.tsx$/.test(
            id,
          )
        )
          return;
        return (
          transformSync(code, {
            filename: id,
            babelrc: false,
            configFile: false,
            parserOpts: { plugins: ["jsx", "typescript"] },
            plugins: [[compiler, { target: "19" }]],
          })?.code ?? undefined
        );
      },
    },
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "client-only": fileURLToPath(import.meta.resolve("@oioi-bwg/config/vitest/client-only")),
      "server-only": fileURLToPath(import.meta.resolve("@oioi-bwg/config/vitest/server-only")),
    },
  },
  test: {
    ...browserTest,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
