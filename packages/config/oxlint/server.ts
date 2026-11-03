import type { DummyRule, Oxlintrc } from "oxlint";
import { nodeConfig } from "./node.ts";

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
  "@oioi-bwg/config",
  "@oioi-bwg/config/**",
];
const restricted = (patterns: string[]): DummyRule => [
  2,
  { patterns: [{ group: patterns, message: "공통 서버의 앱·framework 및 계층 경계를 지키세요." }] },
];

export const serverConfig: Oxlintrc = {
  ...nodeConfig,
  overrides: [
    ...(nodeConfig.overrides ?? []),
    {
      files: ["src/**/*.ts"],
      rules: {
        "core-js/no-restricted-imports": restricted([...appPatterns, ...frameworkPatterns]),
        "core-js/no-restricted-syntax": [
          2,
          "ImportExpression",
          "CallExpression[callee.name='require']",
        ],
      },
    },
    {
      files: ["src/services/**/*.ts"],
      rules: {
        "core-js/no-restricted-imports": restricted([
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
        "core-js/no-restricted-imports": restricted([
          ...appPatterns,
          ...frameworkPatterns,
          "**/services/**",
          "**/errors/app-error*",
          "**/http/**",
        ]),
      },
    },
  ],
};

export default serverConfig;
