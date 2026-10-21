import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";

import nodeConfig from "./node.ts";

const appPatterns = [
  "@/**",
  "**/apps/**",
  "@oioi-bwg/web",
  "@oioi-bwg/web/**",
  "@oioi-bwg/console",
  "@oioi-bwg/console/**",
];
const frameworkPatterns = [
  "react",
  "react/**",
  "react-dom",
  "react-dom/**",
  "next",
  "next/**",
  "@sentry/nextjs",
];
const restricted = (patterns: string[]): Linter.RuleEntry => [
  "error",
  { patterns: [{ group: patterns, message: "공통 서버의 앱·framework 및 계층 경계를 지키세요." }] },
];

export function createServerConfig(rootDir: string) {
  return defineConfig([
    {
      basePath: rootDir,
      languageOptions: { parserOptions: { tsconfigRootDir: rootDir } },
      files: ["**/*.{js,mjs,cjs,ts,mts,cts}"],
      extends: [
        ...nodeConfig,
        {
          files: ["src/**/*.ts"],
          rules: {
            "no-restricted-imports": restricted([...appPatterns, ...frameworkPatterns]),
            "no-restricted-syntax": [
              "error",
              "ImportExpression",
              "CallExpression[callee.name='require']",
            ],
          },
        },
        {
          files: ["src/services/**/*.ts"],
          rules: {
            "no-restricted-imports": restricted([
              ...appPatterns,
              ...frameworkPatterns,
              "drizzle-orm",
              "drizzle-orm/**",
              "postgres",
              "**/db/postgres-error*",
              "**/http/**",
            ]),
          },
        },
        {
          files: ["src/repositories/**/*.ts"],
          rules: {
            "no-restricted-imports": restricted([
              ...appPatterns,
              ...frameworkPatterns,
              "**/services/**",
              "**/errors/app-error*",
              "**/http/**",
            ]),
          },
        },
      ],
    },
  ]);
}
