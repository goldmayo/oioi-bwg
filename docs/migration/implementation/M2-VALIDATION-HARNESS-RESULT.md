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
  - 동일 레이어의 다른 slice 참조 차단
  - 같은 slice 내부 alias 참조 차단 및 상대 경로 강제
  - 다른 route의 private segment 참조 차단
  - `shared`의 표준 segment vocabulary 검사
  - Node test runner 기반 architecture rule 회귀 테스트
- `eslint-plugin-boundaries`
  - `app → widgets → features → entities → shared` 하향 의존 검사
  - `server`를 FSD가 아닌 별도 축으로 분리
- Steiger
  - segment 없는 slice와 public API 누락 검사
- 공통 명령
  - `pnpm verify`
  - `pnpm lint:fsd`
  - `pnpm format:check`
- Type-aware async safety
  - 처리하지 않은 Promise 차단 (`no-floating-promises`)
  - Promise를 잘못 전달하는 callback 차단 (`no-misused-promises`)
- React/접근성
  - Next.js core-web-vitals가 제공하는 React Hooks 및 JSX a11y error 규칙 유지
- 코드 리뷰 신호
  - 함수 200줄 초과는 헌법에 따라 CI 차단이 아닌 warning
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

## Vinext 잔재 제거

M1에서 Vinext 전환을 제외했으므로 현재 실행 경로에서 다음 항목을 제거했다.

- `.vinext`, `.wrangler`, `dist` 생성물
- 프로젝트의 `migrate-to-vinext` agent skill 및 lock 항목
- `.vinext`/`.wrangler` 전용 ignore
- release hook의 `wrangler types`
- Git에 추적되던 `.wrangler/deploy/config.json`
- README의 Vinext/Cloudflare 현재 구조 설명

Vitest가 테스트 러너 구현으로 사용하는 Vite 전이 의존성과 과거 의사결정을 기록한 migration/plan
문서는 런타임 Vinext 잔재가 아니므로 유지한다.

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
| `pnpm test:harness` | PASS — architecture rule 7 tests |
| `pnpm lint` | EXPECTED FAIL — M2 구조 오류 56건, 리뷰 warning 4건 |
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
