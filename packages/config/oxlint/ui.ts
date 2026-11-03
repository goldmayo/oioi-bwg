import type { Oxlintrc } from "oxlint";
import { reactHooksConfig } from "./base.ts";
import { nodeConfig } from "./node.ts";

export const uiConfig: Oxlintrc = {
  ...nodeConfig,
  plugins: ["typescript", "react"],
  jsPlugins: [...(nodeConfig.jsPlugins ?? []), ...(reactHooksConfig.jsPlugins ?? [])],
  overrides: [
    ...(nodeConfig.overrides ?? []),
    {
      files: ["**/*.{ts,tsx}"],
      env: { browser: true },
      rules: {
        ...reactHooksConfig.rules,
        "core-js/no-restricted-imports": [
          2,
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
  ],
};

export default uiConfig;
