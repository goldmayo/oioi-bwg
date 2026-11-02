import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";

import { transferredTypeScriptRules } from "../oxlint/index.ts";

export const baseConfig = defineConfig([
  ...tseslint.configs.recommended,
  {
    rules: {
      ...Object.fromEntries(
        transferredTypeScriptRules.map((rule) => [`@typescript-eslint/${rule}`, "off"]),
      ),
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-unused-expressions": "warn",
    },
  },
]);

export default baseConfig;
