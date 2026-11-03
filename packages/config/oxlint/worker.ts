import { createRequire } from "node:module";
import type { Oxlintrc } from "oxlint";
import { nodeConfig } from "./node.ts";

const resolveModule = createRequire(import.meta.url).resolve;

export const workerConfig: Oxlintrc = {
  ...nodeConfig,
  jsPlugins: [
    ...(nodeConfig.jsPlugins ?? []),
    { name: "worker-boundary", specifier: resolveModule("./worker-plugin.ts") },
  ],
  overrides: [
    ...(nodeConfig.overrides ?? []),
    {
      files: ["src/**/*.{ts,mts}"],
      rules: {
        "worker-boundary/local-import": [2],
        "core-js/no-restricted-imports": [
          2,
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
                message: "독립 Worker runtime은 앱·공통 서버·tooling 및 Node에 의존하지 않습니다.",
              },
            ],
          },
        ],
        "core-js/no-restricted-syntax": [
          2,
          "ImportExpression",
          "CallExpression[callee.name='require']",
        ],
      },
    },
  ],
};

export default workerConfig;
