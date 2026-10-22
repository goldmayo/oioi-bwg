import path from "node:path";
import type { Rule } from "eslint";
import { defineConfig } from "eslint/config";

import { createNodeConfig } from "./node.ts";

export function createWorkerConfig(rootDir: string) {
  const localImports: Rule.RuleModule = {
    meta: {
      type: "problem",
      schema: [],
      messages: { outside: "Worker 소스 밖의 상대 경로를 import하지 않습니다." },
    },
    create(context) {
      const check = (
        source: Extract<Rule.Node, { type: "ImportDeclaration" }>["source"] | null | undefined,
      ) => {
        if (!source || typeof source.value !== "string") return;
        const specifier = source.value;
        if (!specifier.startsWith(".") && !path.isAbsolute(specifier)) return;
        const relative = path.relative(
          path.resolve(rootDir, "src"),
          path.resolve(path.dirname(context.filename), specifier),
        );
        if (
          relative === ".." ||
          relative.startsWith(`..${path.sep}`) ||
          path.isAbsolute(relative)
        ) {
          context.report({ node: source, messageId: "outside" });
        }
      };
      return {
        ImportDeclaration: (node) => check(node.source),
        ExportNamedDeclaration: (node) => check(node.source),
        ExportAllDeclaration: (node) => check(node.source),
      };
    },
  };
  return defineConfig([
    {
      basePath: rootDir,
      files: ["**/*.{ts,mts}"],
      extends: [
        ...createNodeConfig(rootDir),
        {
          files: ["src/**/*.{ts,mts}"],
          plugins: { "worker-boundary": { rules: { "local-import": localImports } } },
          rules: {
            "worker-boundary/local-import": "error",
            "no-restricted-imports": [
              "error",
              {
                patterns: [
                  {
                    group: [
                      "@/**",
                      "@oioi-bwg/**",
                      "**/apps/**",
                      "**/packages/**",
                      "next",
                      "next/**",
                      "react",
                      "react/**",
                      "react-dom",
                      "react-dom/**",
                      "node:*",
                    ],
                    message:
                      "독립 Worker runtime은 앱·공통 서버·tooling 및 Node에 의존하지 않습니다.",
                  },
                ],
              },
            ],
            "no-restricted-syntax": [
              "error",
              "ImportExpression",
              "CallExpression[callee.name='require']",
            ],
          },
        },
      ],
    },
  ]);
}
