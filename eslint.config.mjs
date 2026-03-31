import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettierConfig from "eslint-config-prettier";
import boundariesPlugin from "eslint-plugin-boundaries"; // FSD 경계 설정을 위해 추가
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      "unused-imports": unusedImports,
      "simple-import-sort": simpleImportSort,
      boundaries: boundariesPlugin,
    },
    settings: {
      // FSD 레이어 정의: 어이어이바위게 프로젝트 구조에 맞춤
      "boundaries/elements": [
        { type: "app", pattern: "src/app/**/*" },
        { type: "containers", pattern: "src/containers/**/*" },
        { type: "features", pattern: "src/features/**/*" },
        { type: "shared", pattern: "src/shared/**/*" },
      ],
      "boundaries/ignore": ["**/*.d.ts", "**/*.test.ts", "**/*.stories.tsx"],
    },
    rules: {
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
      "no-unused-vars": "off", // 기본 rule 끄기
      "@typescript-eslint/no-unused-vars": "off", // TS rule 끄기
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // FSD 계층 간 의존성 규칙 (Strict)
      "boundaries/element-types": [
        "error",
        {
          default: "disallow",
          rules: [
            { from: "shared", allow: ["shared"] },
            { from: "features", allow: ["shared", "features"] },
            { from: "containers", allow: ["shared", "features", "containers"] },
            { from: "app", allow: ["shared", "features", "containers", "app"] },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Cloudflare & Vinext artifacts
    ".wrangler/**",
    ".vinext/**",
    "dist/**",
    "worker-configuration.d.ts",
  ]),
  prettierConfig,
]);

export default eslintConfig;
