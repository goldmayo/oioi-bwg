---
title: "M2 Validation Harness Result"
document_id: "M2-VALIDATION-HARNESS-RESULT"
version: "1.0"
status: "active"
authority: "plan"
updated_at: "2026-08-29"
depends_on:
  - "M2-STRUCTURE"
---

# M2 Validation Harness Result

## 목적

M2 구조 이동 전에 헌법 01/02의 FSD 및 Next App Router 경계를 기계적으로 검사한다. 다른
Vite/TanStack Router 프로젝트에서 가져온 `docs/migration/harness/` 자료는 참고 입력으로만
사용하고, 현재 Next.js 16 + pnpm 프로젝트에 맞게 다시 구성했다.

## 적용한 하네스

- ESLint custom architecture rule
  - 허용된 `src` 최상위 구조 검사
  - promoted slice의 `ui/model/api/lib/config` segment 검사
  - route-local `_ui/_model/_lib/_config` 검사
  - promoted slice `index.ts` public API 우회 import 차단
  - `shared`의 표준 segment vocabulary 검사
- `eslint-plugin-boundaries`
  - `app → widgets → features → entities → shared` 하향 의존 검사
  - `server`를 FSD가 아닌 별도 축으로 분리
- Steiger
  - segment 없는 slice와 public API 누락 검사
- 공통 명령
  - `pnpm verify`
  - `pnpm lint:fsd`
  - `pnpm format:check`
- Git hooks
  - pre-commit: 변경 파일 lint/format
  - pre-push: 전체 verify
- GitHub Actions
  - PR 및 `main`/`develop`/`migration_develop` push에서 install/verify/format check

## 가져온 자료에서 적용하지 않은 항목

- TanStack Router 전용 `-*` route colocation
- Vite/React Refresh/TanStack ESLint config
- npm 기반 install/CI
- Node-only Vitest 강제
- Vite bundle manifest 및 React Scan

현재 헌법에 따라 route-local private segment는 `_ui/_model/_lib/_config`로 고정한다. 기존 jsdom
Vitest 테스트도 유지한다.

## `.mjs` 설정 정리

- `eslint.config.mjs` → `eslint.config.mts`
- `next.config.mjs` → `next.config.ts`
- `postcss.config.mjs` → `package.json#postcss`

Next.js 16.3.3은 현재 Node 22.16 환경에서 `next.config.mts`를 지원하지 않고 PostCSS config
탐색기도 `.mts`를 읽지 않는다. 따라서 지원되는 TypeScript config와 package config를 사용해
루트 `.mjs` 설정 파일을 0개로 만들었다.

## 검증 결과

| 검증 | 결과 |
|---|---|
| `pnpm install --frozen-lockfile` | PASS |
| `pnpm type-check` | PASS |
| `pnpm test:unit:run` | PASS — 5 files, 21 tests |
| `pnpm format:check` | PASS |
| `pnpm build` | PASS — Next.js 16.3.3 standalone |
| `pnpm lint` | EXPECTED FAIL — 기존 M2 구조 위반 60건 |
| `pnpm lint:fsd` | EXPECTED FAIL — 기존 slice 구조 위반 5건 |
| `pnpm verify` | BLOCKED — 위 구조 위반이 0이 될 때 통과 |

## M2 완료 조건

M2에서 다음이 모두 0이 되어야 한다.

- 허용되지 않은 `src/containers`
- promoted slice 루트의 `index.ts` 외 파일
- promoted slice deep import
- 비표준 `shared/components`, `shared/hooks`, `shared/types`, `shared/utils`, `shared/constants`
- segment 없는 feature slice
- public API 없는 feature slice

구조 오류를 suppression이나 ignore로 숨기지 않고 실제 이동으로 해결한다.
