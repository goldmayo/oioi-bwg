import path from "node:path";

import type { Rule } from "eslint";

/** 기존 Worker 경계 규칙의 rootDir closure를 실행기와 분리한다. */
export function createWorkerLocalImportRule(rootDir: string): Rule.RuleModule {
  return {
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
}
