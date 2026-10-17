---
title: "P03 공통 계약 패키지 분리 결과"
kind: "result"
status: "active"
verified_source:
  repository: "goldmayo/oioi-bwg"
  branch: "feature/p03-shared-contracts-server"
  commit: "c713c478f56be14a0e940249e5d99531382efb5b"
verified_at: "2026-10-07"
---

# P03 공통 계약 패키지 분리 결과

[P03 계획](P03-PLAN.md)의 첫 concern을 구현했다. `migration_main` 기준은
`d2b5e9eb8e9c71492f2779fc1eba2965075fdf1b`다. 서버 추출은 다음 PR에서 진행한다.

## 변경 범위

기존 schema/DTO 다섯 파일과 계약 테스트를 수정 없이 `packages/contracts/src`로 이동했다.
Web과 PostgreSQL integration consumer는 명시적인 `@oioi-bwg/contracts/*` export를 사용한다.
계약 이름과 payload, authorization enum은 그대로다. 계약 패키지는 Zod만 runtime dependency로
가지며 실제 ESLint negative fixture가 Node/React/Next/server/app 참조를 거부한다.

Next source transpilation과 Docker manifest를 연결했다. Turbo의 `transit` dependency가 별도
library build 없이 package source 변경을 Web 검사와 build hash로 전달한다. 격리 Git fixture에서
공통 mock 및 contracts source 변경에 대해 Web task 선택과 hash 변경을 확인한다.
헌법·Frontend·Contract의 owning architecture에 package 경계를 반영했다.

## 실행한 검증

사용자 앱 환경 파일이 없는 별도 worktree에서 다음을 실행했다. 외부 DB에 연결하지 않았다.

| 명령/검사 | 결과 |
| --- | --- |
| `pnpm install --frozen-lockfile` | 성공 |
| `SENTRY_SOURCE_MAPS_ENABLED=false NEXT_PUBLIC_APP_ENV=staging pnpm verify` (DB/Auth/Sentry token 미설정) | 성공 |
| contracts unit | 1개 파일 / 3개 성공 |
| Web unit | 56개 파일 / 237개 성공 |
| architecture harness | 14개 성공 |
| ops | 4개 파일 / 51개 성공 |
| workspace/root type-check·ESLint, Web Steiger, format | 성공 |
| Next production build | 성공 |
| 동일 환경 `pnpm exec turbo run type-check lint test` 재실행 | 6/6 cache hit |

`pnpm exec tsx scripts/assert-local-database.ts`는 기존 로컬 환경의 외부 DB hostname을 거부했다.
사용자 환경 파일은 변경하지 않았다. WSL에서 Docker daemon을 사용할 수 없어 PostgreSQL
integration과 Docker container smoke는 로컬 실행하지 않았다. 해당 CI gate는 유지하며 PR 결과와
로컬 결과를 구분한다.

## 보류 항목

서버 package 분리와 app request/HTTP adapter 경계는 P03 두 번째 PR에서 진행한다.
Console 앱/인증과 UI 이관은 후속 checkpoint다. 배포 및 자동 병합은 포함하지 않는다.
