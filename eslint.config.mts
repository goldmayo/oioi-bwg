import { defineConfig, globalIgnores } from "eslint/config";
import type { Linter } from "eslint";

import consolePolicy from "./apps/console/eslint/policy.mjs";
import webPolicy from "./apps/web/eslint/policy.mjs";
import nextConfig from "./config/eslint/next.mjs";

const typedWebPolicy = webPolicy as unknown as Linter.Config[];

export default defineConfig([
  ...nextConfig,
  ...typedWebPolicy,
  ...(consolePolicy as unknown as Linter.Config[]),
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
