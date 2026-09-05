import { defineConfig, globalIgnores } from "eslint/config";
import type { ESLint } from "eslint";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import boundariesPlugin from "eslint-plugin-boundaries";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

import { architectureRule } from "./eslint-rules/architecture.js";

const projectPlugin = {
  rules: {
    architecture: architectureRule,
  },
} as unknown as ESLint.Plugin;

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "unused-imports": unusedImports,
      "simple-import-sort": simpleImportSort,
      boundaries: boundariesPlugin,
      project: projectPlugin,
    },
    settings: {
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app", mode: "folder" },
        { type: "widgets", pattern: "src/widgets/*", mode: "folder", capture: ["slice"] },
        { type: "features", pattern: "src/features/*", mode: "folder", capture: ["slice"] },
        { type: "entities", pattern: "src/entities/*", mode: "folder", capture: ["slice"] },
        { type: "shared", pattern: "src/shared", mode: "folder" },
        { type: "server", pattern: "src/server", mode: "folder" },
      ],
      "import/resolver": {
        typescript: {
          project: "./tsconfig.json",
          alwaysTryTypes: true,
        },
      },
    },
    rules: {
      "project/architecture": "error",
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^\\u0000"],
            ["^node:"],
            ["^react", "^@?\\w"],
            ["^@/app"],
            ["^@/widgets"],
            ["^@/features"],
            ["^@/entities"],
            ["^@/server"],
            ["^@/shared"],
            ["^\\.\\."],
            ["^\\./"],
            ["^.+\\.s?css$"],
          ],
        },
      ],
      "simple-import-sort/exports": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false } },
      ],
      "max-lines-per-function": ["warn", { max: 250, skipComments: true, skipBlankLines: true }],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message: "FSD dependency 위반: {{from.type}} → {{to.type}}",
          rules: [
            {
              from: { type: "app" },
              allow: {
                to: { type: ["app", "widgets", "features", "entities", "shared", "server"] },
              },
            },
            {
              from: { type: "widgets" },
              allow: { to: { type: ["widgets", "features", "entities", "shared"] } },
            },
            {
              from: { type: "features" },
              allow: { to: { type: ["features", "entities", "shared"] } },
            },
            { from: { type: "entities" }, allow: { to: { type: ["entities", "shared"] } } },
            { from: { type: "shared" }, allow: { to: { type: ["shared"] } } },
            { from: { type: "server" }, allow: { to: { type: ["server", "shared"] } } },
          ],
        },
      ],
    },
  },
  {
    files: ["**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "boundaries/dependencies": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "coverage/**",
    ".agents/**",
    ".local/**",
    "docs/migration/harness/**",
    "next-env.d.ts",
  ]),
  prettierConfig,
]);

export default eslintConfig;
