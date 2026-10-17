import { defineConfig } from "eslint/config";

import nodeConfig from "../../config/eslint/node.mjs";

export default defineConfig([
  ...nodeConfig,
  {
    files: ["src/**/*.ts"],
    ignores: ["src/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
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
      "no-restricted-syntax": [
        "error",
        "ImportExpression",
        "CallExpression[callee.name='require']",
      ],
    },
  },
]);
