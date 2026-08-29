//  @ts-check

import { tanstackConfig } from "@tanstack/eslint-config";
import prettier from "eslint-config-prettier";
import boundaries from "eslint-plugin-boundaries";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import simpleImportSort from "eslint-plugin-simple-import-sort";
import unusedImports from "eslint-plugin-unused-imports";

import { segmentPlacement } from "./eslint-rules/segment-placement.js";

/**
 * FSD 레이어 — 하향 의존만 (app이 최상위, shared가 최하위).
 *
 * `pages` 레이어는 쓰지 않습니다 (docs 03에서 의도적으로 이탈).
 * TanStack Router의 route 파일이 path·loader·validateSearch·가드·화면을 함께 소유하므로
 * pages 슬라이스는 1:1 래퍼가 되어 재사용에 기여하지 않았습니다.
 * 화면 전용 코드는 route 폴더의 `-` 접두사 콜로케이션에 두고,
 * 재사용되는 것만 widgets/features/entities/shared로 올립니다.
 */
const LAYERS = ["app", "widgets", "features", "entities", "shared"];

/** 해당 레이어가 import할 수 있는 하위 레이어 목록 (자기 레이어 제외 = 슬라이스 간 참조 금지) */
const allowBelow = (/** @type {string} */ layer) => LAYERS.slice(LAYERS.indexOf(layer) + 1);

export default [
  {
    ignores: [
      "dist",
      "coverage",
      ".claude", // 에이전트 워크트리·스킬 문서 — 별도 체크아웃이라 여기서 린트하면 안 됨
      ".agents",
      "src/app/routeTree.gen.ts", // 생성물 — TanStack Router가 덮어씀
      // ⚠️ src/shared/ui (shadcn)는 넣지 말 것 — 우리 코드라 린트/리뷰 대상
      "eslint.config.js",
      "prettier.config.js",
      "eslint-rules", // 린트 규칙 자체 — 설정 파일과 같은 취급
    ],
  },

  ...tanstackConfig,

  {
    name: "project/tanstack-overrides",
    rules: {
      /**
       * 함수 길이 상한 — **경고**입니다(2026-08-13 팀 기준).
       *
       * 줄 수는 증상이지 원인이 아닙니다. 폼 필드 스무 개짜리 컴포넌트는 400줄이어도 로직이
       * 아니라 선언이 길 뿐이라, 억지로 `<Section1/>`으로 자르면 오히려 읽기 어려워집니다.
       * 그래서 error가 아니라 warn이고 예외를 허용합니다 — 실제로 더 잘 지켜집니다.
       *
       * 걸렸을 때 순서는 **로직 먼저**입니다: 상태·effect 묶음을 커스텀 훅으로 뺀 다음, 그래도
       * 길면 UI를 나눕니다. UI를 먼저 자르면 props drilling만 늘어납니다.
       *
       * 줄 수보다 먼저 보는 신호: state 5개 이상 / effect 3개 이상 / JSX 중첩 4단계 초과 /
       * "이 컴포넌트는 X를 한다"에 '그리고'가 들어감 / props 8개 초과.
       */
      "max-lines-per-function": ["warn", { max: 200, skipComments: true, skipBlankLines: true }],
      "import/no-cycle": "off",
      "import/order": "off", // simple-import-sort가 담당
      "sort-imports": "off",
      "@typescript-eslint/array-type": "off",
      "@typescript-eslint/require-await": "off",
      "pnpm/json-enforce-catalog": "off",
    },
  },

  // ① FSD 경계 — 레이어 하향 의존만 + 슬라이스 간 참조 금지 + public API 강제
  {
    name: "project/fsd-boundaries",
    files: ["src/**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "boundaries/include": ["src/**/*"],
      "boundaries/elements": [
        { type: "app", pattern: "src/app" },
        {
          type: "widgets",
          pattern: "src/widgets/*",
          capture: ["slice"],
        },
        {
          type: "features",
          pattern: "src/features/*",
          capture: ["slice"],
        },
        {
          type: "entities",
          pattern: "src/entities/*",
          capture: ["slice"],
        },
        { type: "shared", pattern: "src/shared" },
      ],
      // 경로 alias(@/*) 해석 — 없으면 boundaries가 조용히 아무것도 안 잡음
      "import/resolver": { typescript: { alwaysTryTypes: true } },
    },
    rules: {
      // policies는 last-write-wins — 뒤에 오는 정책이 앞의 판정을 덮음
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          message: "FSD 위반: {{from.element.type}} → {{to.element.type}} (하향 의존만 허용)",
          policies: [
            // 외부 패키지 / node 빌트인은 제한 없음
            { allow: { to: { module: { origin: "external" } } } },
            { allow: { to: { module: { origin: "core" } } } },

            // 같은 슬라이스 내부(상대 경로)는 제한 없음
            { allow: { dependency: { relationship: { to: "internal" } } } },

            // 레이어 하향 의존만 (자기 레이어 제외 = 슬라이스 간 참조 금지)
            ...LAYERS.map((layer) => ({
              from: { element: { type: layer } },
              allow: { to: { element: { types: { anyOf: allowBelow(layer) } } } },
            })),

            // public API 강제 — shared를 제외한 슬라이스는 index.ts만 노출
            {
              disallow: {
                to: {
                  element: {
                    types: { anyOf: ["widgets", "features", "entities"] },
                    fileInternalPath: "!index.ts",
                  },
                },
              },
              message: "public API(index.ts)를 통해 import하세요: {{to.element.type}}/{{to.internalPath}}",
            },
          ],
        },
      ],
    },
  },

  // ② import 정렬(FSD 레이어 순) + 미사용 import 제거
  {
    name: "project/imports",
    files: ["**/*.{ts,tsx}"],
    plugins: {
      "simple-import-sort": simpleImportSort,
      "unused-imports": unusedImports,
    },
    rules: {
      "simple-import-sort/imports": [
        "error",
        {
          groups: [
            ["^\\u0000"], // side-effect import
            ["^node:"],
            ["^react", "^@?\\w"], // 외부 패키지
            ["^@/app"],
            ["^@/pages"],
            ["^@/widgets"],
            ["^@/features"],
            ["^@/entities"],
            ["^@/shared"],
            ["^\\.\\."],
            ["^\\./"],
            ["^.+\\.s?css$"], // 스타일 마지막
          ],
        },
      ],
      "simple-import-sort/exports": "error",

      "unused-imports/no-unused-imports": "error",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  /**
   * ③-0 비동기 실패 처리 안전망 (감사 §5-B) — **Promise 방치가 이 앱의 실질 버그 클래스**입니다.
   *
   * `mutateAsync`는 실패 시 reject를 던지므로, 받은 Promise를 매듭짓지 않으면
   * (await+분기, `attemptAsync`, 또는 의도적 `void`) 실패가 unhandled rejection으로 새거나
   * "실패했는데 모달이 닫히는" 오동작이 됩니다. 사람 기억력 대신 기계로 강제합니다 —
   * 기존 코드는 `void` 관례를 이미 지키고 있어 도입 비용이 거의 없었습니다(도입 시점 실측).
   *
   * `attributes: false` — RHF의 `onSubmit={form.handleSubmit(...)}`처럼 JSX 속성에
   * Promise 반환 핸들러를 넘기는 것은 React가 반환값을 쓰지 않는 정상 관용구입니다.
   * 타입 정보는 베이스(@tanstack/eslint-config)가 이미 `project: true`로 켜 두어 별도 설정 불요.
   */
  {
    name: "project/async-safety",
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
    },
  },

  // ③ React
  {
    ...reactHooks.configs.flat.recommended,
    name: "project/react-hooks",
    files: ["src/**/*.{ts,tsx}"],
  },
  {
    ...jsxA11y.flatConfigs.recommended,
    name: "project/jsx-a11y",
    files: ["src/**/*.tsx"],
  },
  {
    ...reactRefresh.configs.vite,
    name: "project/react-refresh",
    files: ["src/**/*.tsx"],
  },

  // shadcn 컴포넌트는 cva variants(buttonVariants 등)를 함께 export하는 구조 —
  // 규칙 하나만 해제. 디렉터리를 ignore하면 안 됨 (우리 코드라 나머지 규칙은 계속 적용)
  {
    name: "project/shadcn-ui",
    files: ["src/shared/ui/**/*.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },

  /**
   * ③ 라우트 콜로케이션 격리 — boundaries가 못 잡는 부분을 메웁니다.
   * `src/app` 전체가 boundaries의 단일 element라서 화면끼리 import해도 걸리지 않습니다.
   * 콜로케이션(`-` 접두사)은 자기 라우트 폴더와 바로 위 폴더까지만 쓰고,
   * 그 밖에서 필요해지면 widgets/features/entities/shared로 올립니다.
   */
  {
    name: "project/segment-placement",
    files: ["src/**/*.{ts,tsx}"],
    plugins: { project: { rules: { "segment-placement": segmentPlacement } } },
    rules: { "project/segment-placement": "error" },
  },

  {
    name: "project/route-colocation",
    files: ["src/app/routes/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../**/-*", "../../**/-*/**", "@/app/routes/**"],
              message:
                "다른 라우트의 콜로케이션(-*)을 import하지 마세요. 재사용이 필요하면 widgets/features/entities/shared로 올리세요.",
            },
          ],
        },
      ],
    },
  },

  // 라우트 파일은 컴포넌트 외에 Route를 export해야 함 (fast refresh 예외)
  {
    name: "project/route-files",
    files: ["src/app/routes/**/*.tsx"],
    rules: {
      // Route(비컴포넌트) + 로컬 컴포넌트 조합은 이 규칙이 항상 잡음 — 라우트 파일 관례
      "react-refresh/only-export-components": "off",
    },
  },

  // 테스트 파일은 경계 검사 제외
  {
    name: "project/tests",
    files: ["**/*.{test,spec}.{ts,tsx}", "e2e/**/*.ts"],
    rules: { "boundaries/dependencies": "off" },
  },

  prettier,
];
