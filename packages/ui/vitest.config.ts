import { defineConfig } from "vitest/config";
import { transformSync } from "@babel/core";
import compiler from "babel-plugin-react-compiler";

import { browserTest } from "@oioi-bwg/config/vitest/browser";

export default defineConfig({
  root: import.meta.dirname,
  plugins: [
    {
      name: "compound-table-react-compiler",
      enforce: "pre",
      transform(code, id) {
        if (
          !id.startsWith(import.meta.dirname + "/src/") ||
          !id.endsWith(".tsx") ||
          id.endsWith(".test.tsx")
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
  test: {
    ...browserTest,
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
