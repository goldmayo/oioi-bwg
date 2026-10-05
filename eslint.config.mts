import { defineConfig, globalIgnores } from "eslint/config";

import webPolicy from "./apps/web/eslint/policy.mjs";
import nextConfig from "./config/eslint/next.mjs";

export default defineConfig([
  ...nextConfig,
  ...webPolicy,
  globalIgnores([
    "**/.next/**",
    "out/**",
    "build/**",
    "coverage/**",
    ".agents/**",
    ".local/**",
    "docs/migration/harness/**",
    "**/next-env.d.ts",
  ]),
]);
