import type { Oxlintrc } from "oxlint";

import baseConfig from "./base.json" with { type: "json" };

export const transferredTypeScriptRules = Object.keys(baseConfig.rules)
  .filter((rule) => rule.startsWith("typescript/"))
  .map((rule) => rule.replace("typescript/", ""));

export function createOxlintConfig(appSourcePatterns: string[] = []): Oxlintrc {
  return {
    ...(baseConfig as Oxlintrc),
    ignorePatterns: [
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/coverage/**",
      "**/next-env.d.ts",
    ],
    overrides: appSourcePatterns.length
      ? [
          {
            files: appSourcePatterns,
            rules: {
              "typescript/no-floating-promises": "error",
              "typescript/no-misused-promises": [
                "error",
                { checksVoidReturn: { attributes: false } },
              ],
              "max-lines-per-function": [
                "warn",
                { max: 250, skipComments: true, skipBlankLines: true },
              ],
            },
          },
        ]
      : [],
  };
}
