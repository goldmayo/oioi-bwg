import { createRequire } from "node:module";
import type { Oxlintrc } from "oxlint";

const resolveModule = createRequire(import.meta.url).resolve;

export const baseConfig: Oxlintrc = {
  plugins: ["typescript"],
  categories: { correctness: "off" },
  env: { builtin: true },
  ignorePatterns: ["**/*.jsx"],
  jsPlugins: [
    { name: "core-js", specifier: resolveModule("./core-plugin.ts") },
    { name: "typescript-js", specifier: resolveModule("@typescript-eslint/eslint-plugin") },
  ],
  rules: {
    "typescript-js/ban-ts-comment": [2],
    "no-array-constructor": [2],
    "typescript/no-duplicate-enum-values": [2],
    "typescript/no-empty-object-type": [2],
    "typescript/no-explicit-any": [2],
    "typescript/no-extra-non-null-assertion": [2],
    "typescript/no-misused-new": [2],
    "typescript/no-namespace": [2],
    "typescript/no-non-null-asserted-optional-chain": [2],
    "typescript/no-require-imports": [2],
    "typescript/no-this-alias": [2],
    "typescript/no-unnecessary-type-constraint": [2],
    "typescript-js/no-unsafe-declaration-merging": [2],
    "typescript/no-unsafe-function-type": [2],
    "no-unused-expressions": [
      1,
      {
        allowShortCircuit: false,
        allowTaggedTemplates: false,
        allowTernary: false,
      },
    ],
    "typescript-js/no-unused-vars": [1],
    "typescript/no-wrapper-object-types": [2],
    "typescript/prefer-as-const": [2],
    "typescript/prefer-namespace-keyword": [2],
    "typescript/triple-slash-reference": [2],
  },
  overrides: [
    {
      files: ["**/*.{ts,tsx,mts,cts}"],
      rules: {
        "core-js/no-var": [2],
        "prefer-const": [
          2,
          {
            destructuring: "any",
            ignoreReadBeforeAssign: false,
          },
        ],
        "prefer-rest-params": [2],
        "prefer-spread": [2],
      },
    },
  ],
};

export const reactHooksConfig: Oxlintrc = {
  plugins: ["react"],
  jsPlugins: [{ name: "react-hooks-js", specifier: resolveModule("eslint-plugin-react-hooks") }],
  rules: {
    "react/rules-of-hooks": [2],
    "react/exhaustive-deps": [1],
    "react/static-components": [2],
    "react/use-memo": [2],
    "react-hooks-js/preserve-manual-memoization": [2],
    "react/incompatible-library": [1],
    "react/immutability": [2],
    "react/globals": [2],
    "react/refs": [2],
    "react/set-state-in-effect": [2],
    "react/error-boundaries": [2],
    "react/purity": [2],
    "react/set-state-in-render": [2],
    "react/unsupported-syntax": [1],
    "react-hooks-js/config": [2],
    "react-hooks-js/gating": [2],
  },
};

export default baseConfig;
