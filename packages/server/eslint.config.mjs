import { defineConfig } from "eslint/config";

import nodeConfig from "../../config/eslint/node.mjs";

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
const restricted = (patterns) => [
  "error",
  { patterns: [{ group: patterns, message: "공통 서버의 앱·framework 및 계층 경계를 지키세요." }] },
];

export default defineConfig([
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
]);
