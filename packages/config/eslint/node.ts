import { defineConfig, globalIgnores } from "eslint/config";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

import { baseConfig } from "./base.ts";

export function createNodeConfig(rootDir: string) {
  return defineConfig([
    ...baseConfig,
    {
      files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
      languageOptions: {
        globals: globals.node,
        parserOptions: { tsconfigRootDir: rootDir },
      },
    },
    globalIgnores([
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/coverage/**",
      ".agents/**",
      ".local/**",
      "docs/migration/harness/**",
      "**/next-env.d.ts",
    ]),
    prettierConfig,
  ]);
}
