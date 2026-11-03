import type { Oxlintrc } from "oxlint";
import { baseConfig } from "./base.ts";

export const nodeConfig: Oxlintrc = {
  ...baseConfig,
  ignorePatterns: [
    ...(baseConfig.ignorePatterns ?? []),
    "**/.next/**",
    "**/out/**",
    "**/build/**",
    "**/coverage/**",
    "**/next-env.d.ts",
    ".agents/**",
    ".local/**",
    "docs/migration/harness/**",
  ],
  overrides: [
    ...(baseConfig.overrides ?? []),
    { files: ["**/*.{js,mjs,cjs,ts,mts,cts}"], env: { node: true } },
  ],
};

export default nodeConfig;
