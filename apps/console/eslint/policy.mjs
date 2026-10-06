import path from "node:path";

import boundariesPlugin from "eslint-plugin-boundaries";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

import { architectureRule } from "../../../harness/architecture/eslint-rule.js";

const repositoryRoot = path.resolve(import.meta.dirname, "../../..");
const consoleRoot = path.join(repositoryRoot, "apps/console");
const tsconfigPath = path.join(consoleRoot, "tsconfig.json");

const projectPlugin = {
  rules: {
    architecture: architectureRule,
  },
};

export const consolePolicy = [
  { settings: { next: { rootDir: consoleRoot } } },
  {
    files: ["apps/console/src/**/*.{ts,tsx}"],
    languageOptions: {
      parserOptions: {
        project: tsconfigPath,
        tsconfigRootDir: repositoryRoot,
      },
    },
    plugins: {
      "unused-imports": unusedImports,
      "simple-import-sort": simpleImportSort,
      boundaries: boundariesPlugin,
      project: projectPlugin,
    },
    settings: {
      "boundaries/root-path": repositoryRoot,
      "boundaries/include": ["apps/console/src/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "apps/console/src/app", mode: "folder" },
        {
          type: "widgets",
          pattern: "apps/console/src/widgets/*",
          mode: "folder",
          capture: ["slice"],
        },
        {
          type: "features",
          pattern: "apps/console/src/features/*",
          mode: "folder",
          capture: ["slice"],
        },
        {
          type: "entities",
          pattern: "apps/console/src/entities/*",
          mode: "folder",
          capture: ["slice"],
        },
        { type: "shared", pattern: "apps/console/src/shared", mode: "folder" },
        { type: "server", pattern: "apps/console/src/server", mode: "folder" },
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
    files: ["apps/console/**/*.{test,spec}.{ts,tsx}"],
    rules: {
      "boundaries/dependencies": "off",
    },
  },
];

export default consolePolicy;
