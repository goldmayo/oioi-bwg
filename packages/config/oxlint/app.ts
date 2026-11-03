import { createRequire } from "node:module";
import path from "node:path";
import type { Oxlintrc } from "oxlint";
import { reactHooksConfig } from "./base.ts";
import { nodeConfig } from "./node.ts";

const resolveModule = createRequire(import.meta.url).resolve;

export function createAppConfig(rootDir: string, reactVersion: string): Oxlintrc {
  const appRoot = path.resolve(rootDir);
  return {
    ...nodeConfig,
    plugins: ["typescript", "react", "nextjs", "jsx-a11y", "import"],
    jsPlugins: [
      ...(nodeConfig.jsPlugins ?? []),
      ...(reactHooksConfig.jsPlugins ?? []),
      { name: "react-js", specifier: resolveModule("eslint-plugin-react") },
      { name: "nextjs-js", specifier: resolveModule("@next/eslint-plugin-next") },
      { name: "jsx-a11y-js", specifier: resolveModule("eslint-plugin-jsx-a11y") },
      { name: "boundaries", specifier: resolveModule("eslint-plugin-boundaries") },
      { name: "simple-import-sort", specifier: resolveModule("eslint-plugin-simple-import-sort") },
      { name: "unused-imports", specifier: resolveModule("eslint-plugin-unused-imports") },
      { name: "project", specifier: resolveModule("./project-plugin.ts") },
    ],
    settings: {
      next: { rootDir: appRoot },
      react: { version: reactVersion },
      "import/parsers": { "@typescript-eslint/parser": [".ts", ".mts", ".cts", ".tsx", ".d.ts"] },
      "import/resolver": {
        [resolveModule("eslint-import-resolver-node")]: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
        },
        [resolveModule("eslint-import-resolver-typescript")]: { alwaysTryTypes: true },
        typescript: { project: path.join(appRoot, "tsconfig.json"), alwaysTryTypes: true },
      },
      "boundaries/root-path": appRoot,
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app", mode: "folder" },
        { type: "widgets", pattern: "src/widgets/*", mode: "folder", capture: ["slice"] },
        { type: "features", pattern: "src/features/*", mode: "folder", capture: ["slice"] },
        { type: "entities", pattern: "src/entities/*", mode: "folder", capture: ["slice"] },
        { type: "shared", pattern: "src/shared", mode: "folder" },
        { type: "server", pattern: "src/server", mode: "folder" },
      ],
    },
    overrides: [
      ...(nodeConfig.overrides ?? []),
      {
        files: ["**/*.{js,mjs,cjs,ts,mts,tsx}"],
        env: { node: true, browser: true },
        rules: {
          ...reactHooksConfig.rules,
          "react-js/display-name": [2],
          "react/jsx-key": [2],
          "react/jsx-no-comment-textnodes": [2],
          "react/jsx-no-duplicate-props": [2],
          "react/jsx-no-undef": [2],
          "react-js/jsx-uses-react": [2],
          "react-js/jsx-uses-vars": [2],
          "react/no-children-prop": [2],
          "react/no-danger-with-children": [2],
          "react-js/no-deprecated": [2],
          "react/no-direct-mutation-state": [2],
          "react/no-find-dom-node": [2],
          "react/no-is-mounted": [2],
          "react/no-render-return-value": [2],
          "react/no-string-refs": [2],
          "react/no-unescaped-entities": [2],
          "react/require-render-return": [2],
          "nextjs/google-font-display": [1],
          "nextjs/google-font-preconnect": [1],
          "nextjs/next-script-for-ga": [1],
          "nextjs/no-async-client-component": [1],
          "nextjs/no-before-interactive-script-outside-document": [1],
          "nextjs/no-css-tags": [1],
          "nextjs/no-head-element": [1],
          "nextjs-js/no-html-link-for-pages": [2],
          "nextjs/no-img-element": [1],
          "nextjs-js/no-location-assign-relative-destination": [1],
          "nextjs/no-page-custom-font": [1],
          "nextjs/no-styled-jsx-in-document": [1],
          "nextjs/no-sync-scripts": [2],
          "nextjs/no-title-in-document-head": [1],
          "nextjs/no-typos": [1],
          "nextjs/no-unwanted-polyfillio": [1],
          "nextjs/inline-script-id": [2],
          "nextjs/no-assign-module-variable": [2],
          "nextjs/no-document-import-in-page": [2],
          "nextjs-js/no-duplicate-head": [2],
          "nextjs/no-head-import-in-document": [2],
          "nextjs/no-script-component-in-head": [2],
          "import/no-anonymous-default-export": [1],
          "jsx-a11y/alt-text": [
            1,
            {
              elements: ["img"],
              img: ["Image"],
            },
          ],
          "jsx-a11y/aria-props": [1],
          "jsx-a11y/aria-proptypes": [1],
          "jsx-a11y-js/aria-unsupported-elements": [1],
          "jsx-a11y-js/role-has-required-aria-props": [1],
          "jsx-a11y/role-supports-aria-props": [1],
        },
      },
      {
        files: ["src/**/*.{ts,tsx}"],
        rules: {
          "project/architecture": [2],
          "simple-import-sort/imports": [
            2,
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
          "simple-import-sort/exports": [2],
          "typescript/no-floating-promises": [2],
          "typescript/no-misused-promises": [
            2,
            {
              checksVoidReturn: {
                attributes: false,
              },
            },
          ],
          "max-lines-per-function": [
            1,
            {
              max: 250,
              skipComments: true,
              skipBlankLines: true,
            },
          ],
          "unused-imports/no-unused-imports": [2],
          "unused-imports/no-unused-vars": [
            1,
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
            2,
            {
              default: "disallow",
              message: "FSD dependency 위반: {{from.type}} → {{to.type}}",
              rules: [
                {
                  from: {
                    type: "app",
                  },
                  allow: {
                    to: {
                      type: ["app", "widgets", "features", "entities", "shared", "server"],
                    },
                  },
                },
                {
                  from: {
                    type: "widgets",
                  },
                  allow: {
                    to: {
                      type: ["widgets", "features", "entities", "shared"],
                    },
                  },
                },
                {
                  from: {
                    type: "features",
                  },
                  allow: {
                    to: {
                      type: ["features", "entities", "shared"],
                    },
                  },
                },
                {
                  from: {
                    type: "entities",
                  },
                  allow: {
                    to: {
                      type: ["entities", "shared"],
                    },
                  },
                },
                {
                  from: {
                    type: "shared",
                  },
                  allow: {
                    to: {
                      type: ["shared"],
                    },
                  },
                },
                {
                  from: {
                    type: "server",
                  },
                  allow: {
                    to: {
                      type: ["server", "shared"],
                    },
                  },
                },
              ],
            },
          ],
          "typescript-js/no-unused-vars": [0],
        },
      },
      {
        files: ["**/*.{test,spec}.{ts,tsx}"],
        rules: {
          "boundaries/dependencies": [0],
        },
      },
    ],
  };
}

export default createAppConfig;
