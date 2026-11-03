import type { Oxlintrc } from "oxlint";
import { nodeConfig } from "./node.ts";

export const contractsConfig: Oxlintrc = {
  ...nodeConfig,
  overrides: [
    ...(nodeConfig.overrides ?? []),
    {
      files: ["src/**/*.ts"],
      excludeFiles: ["src/**/*.test.ts"],
      rules: {
        "core-js/no-restricted-imports": [
          2,
          {
            patterns: [
              {
                regex: "^(?!zod$|\\./|\\.\\./)",
                message: "공통 계약은 Zod와 내부 계약만 참조합니다.",
              },
              {
                group: ["**/apps/**", "**/server/**"],
                message: "공통 계약은 앱이나 서버 구현을 참조하지 않습니다.",
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

export default contractsConfig;
