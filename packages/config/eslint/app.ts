import path from "node:path";

import type { Linter } from "eslint";
import { defineConfig } from "eslint/config";
import boundariesPlugin from "eslint-plugin-boundaries";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

import { architectureRule } from "./architecture-rule.ts";
import nextConfig from "./next.ts";

export function createAppConfig(rootDir: string) {
  const appRoot = path.resolve(rootDir);
  const tsconfigPath = path.join(appRoot, "tsconfig.json");

  const projectPlugin = {
    rules: {
      architecture: architectureRule,
    },
  };

  const policy: Linter.Config[] = [
    { files: ["**/*.{js,mjs,cjs,ts,mts,tsx}"], settings: { next: { rootDir: appRoot } } },
    {
      files: ["src/**/*.{ts,tsx}"],
      languageOptions: {
        parserOptions: {
          project: tsconfigPath,
          tsconfigRootDir: appRoot,
        },
      },
      plugins: {
        "unused-imports": unusedImports,
        "simple-import-sort": simpleImportSort,
        boundaries: boundariesPlugin,
        project: projectPlugin,
      },
      settings: {
        "boundaries/root-path": appRoot,
        "boundaries/include": ["src/**/*"],
        "boundaries/elements": [
          { type: "app", pattern: "src/app", mode: "folder" },
          { type: "widgets", pattern: "src/widgets/*", mode: "folder", capture: ["slice"] },
          {
            type: "features",
            pattern: "src/features/*",
            mode: "folder",
            capture: ["slice"],
          },
          {
            type: "entities",
            pattern: "src/entities/*",
            mode: "folder",
            capture: ["slice"],
          },
          { type: "shared", pattern: "src/shared", mode: "folder" },
          { type: "server", pattern: "src/server", mode: "folder" },
        ],
        "import/resolver": {
          typescript: {
            project: tsconfigPath,
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
  ];

  return defineConfig([
    {
      basePath: appRoot,
      languageOptions: { parserOptions: { tsconfigRootDir: appRoot } },
      files: ["**/*.{js,mjs,cjs,ts,mts,tsx}"],
      extends: [nextConfig, policy],
    },
  ]);
}
