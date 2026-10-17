import { defineConfig, globalIgnores } from "eslint/config";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";

import { baseConfig } from "./base.mjs";

export const nodeConfig = defineConfig([
  ...baseConfig,
  {
    files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
    languageOptions: {
      globals: globals.node,
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

export default nodeConfig;
