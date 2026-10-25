import { defineConfig } from "eslint/config";
import hooks from "eslint-plugin-react-hooks";
import globals from "globals";

import { createNodeConfig } from "./node.ts";

export function createUiConfig(rootDir: string) {
  return defineConfig([
    {
      basePath: rootDir,
      files: ["**/*.{ts,tsx}"],
      extends: [...createNodeConfig(rootDir), hooks.configs.flat.recommended],
      languageOptions: { globals: globals.browser, parserOptions: { tsconfigRootDir: rootDir } },
      rules: {
        "no-restricted-imports": [
          "error",
          {
            patterns: [
              {
                regex:
                  "^(node:|next(?:/|$)|next-auth(?:/|$)|@oioi-bwg/(?:server|contracts)(?:/|$))",
                message: "공용 UI는 도메인·서버·Next runtime에 의존하지 않습니다.",
              },
            ],
          },
        ],
      },
    },
  ]);
}
