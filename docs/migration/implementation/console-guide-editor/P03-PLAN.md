---
title: "P03 공통 계약과 서버 코드 추출 계획"
kind: migration-plan
status: active
source_commit: d2b5e9eb8e9c71492f2779fc1eba2965075fdf1b
created_at: "2026-10-07"
---

# P03 공통 계약과 서버 코드 추출

[ROADMAP P03](ROADMAP.md)의 실제 계약과 서버 코드를 추출한다. 기준은 P02가 병합된
`migration_main`의 `d2b5e9eb8e9c71492f2779fc1eba2965075fdf1b`다.
상위 기준은 [헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Contract](../../oioi-bwg-architecture-clean-v1/05-contract-validation-architecture.md),
[Server](../../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md)다.

## 실제 의존성과 분리 단위

1. 계약 PR: `shared/contracts`의 album/song/signup/authorization/error와 기존 계약 테스트를
   `packages/contracts`로 이동한다. Web과 기존 integration consumer가 공개 package entry를
   사용한다. Zod payload와 DTO 이름은 유지한다. package 검사, Turbo dependency hash,
   Next source transpilation, Docker workspace manifest 연결과 owning architecture를 함께 갱신한다.
2. 서버 PR: DB/schema·repository·service·CASL rule·application error·email/storage를
   `packages/server`로 이동한다. `React.cache`/Auth.js request acquisition, HTTP response와
   Next/Sentry observability는 Web에 남긴다. service가 받는 context type과 `requireUser`만
   framework 없는 공통 서버 책임으로 분리한다. Drizzle migration 이력은 root `drizzle/`을 유지한다.

서버 PR은 계약 PR의 package를 소비하므로 선행 PR에 의존한다. 두 PR의 기본 대상은
`migration_main`이며, 서버 PR은 선행 변경을 포함하는 draft로 준비한다. 계약 PR 병합 후
서버 PR 기준을 갱신해 독립 서버 diff를 검토한다. 자동 병합은 이번 구현 범위가 아니다.
각 concern에서 기존 파일 이동과 consumer import 변경은 함께 적용한다. 이동/참조 변경으로
파일 수 목표를 넘는 경우 PR 본문에 기계적 이동과 실제 변경의 검토 순서를 적는다.

## 보존할 동작과 경계

- 기존 `/admin`, public API/DTO, Account role/status, service authorization와 transaction을 유지한다.
- DB SQL·physical constraint·pool 수치·migration SQL을 변경하지 않는다.
- contracts는 Zod와 내부 계약만 소비한다. server는 apps/React/Next/UI/HTTP adapter를 소비하지 않는다.
- client에서 server package를 import할 수 없도록 기존 ESLint 경계와 `server-only`를 유지한다.
- 공통 TS source package에 별도 library build를 추가하지 않는다. 앱 build가 source를 소비한다.
- root 자동 탐색 설정은 필요한 진입점으로 남고, package는 자신의 검사 설정을 소유한다.
- 기존 서버 테스트의 HTTP response assertion은 앱 HTTP 테스트가 소유하도록 분리한다.

## 검증과 완료 조건

- 각 PR의 `pnpm verify`: workspace/root type/lint, 독립 Web Steiger, unit/harness/ops,
  format, production build 통과.
- contracts/server source만 바꾸는 격리 fixture에서 Web task hash와 affected 선택 변경을 확인한다.
- package 순수성, server-only와 service→repository→DB 방향을 실제 ESLint 및 harness로 검사한다.
- 기존 PostgreSQL integration 및 Docker standalone/container Playwright CI gate를 유지한다.
  로컬 Docker가 사용 가능하면 동일 gate를 실행하고, 사용 불가하면 그 제한과 CI 결과를 구분한다.
- 결과는 기존 P03 계획을 재작성하지 않고 각 PR의 결과 문서에 source ref·명령·결과를 기록한다.

Console 앱/인증 이관, MFA, CheerGuide, Waveform, 배포 변경은 해당 후속 checkpoint에서 진행한다.
