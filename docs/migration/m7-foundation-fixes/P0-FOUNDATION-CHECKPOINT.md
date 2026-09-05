# M7 P0 Foundation Checkpoint

## Status

FAIL

## Baseline

- 실행 일시: 2026-09-06 05:56 KST
- 브랜치: `migration_M7_P0_Foundation_Checkpoint`
- 통합 HEAD: `050b41591b7cf697cc89e0dbb43dfdc3f6bf995b`
- 비교 기준: 실행 시점 `origin/migration_develop`과 동일한 HEAD
- 검증 대상: 현재 통합 HEAD의 tracked source/test와 각 canonical finding evidence
- PostgreSQL: Docker Compose PostgreSQL `17.11 (Debian 17.11-1.pgdg13+2)`의 finding별 격리 임시 DB
- Production DB, production credential, 실제 R2 write는 사용하지 않았다.

## Included Findings

- DATA-001 — `CLOSED`
- DATA-009 — `CLOSED`
- DATA-004 — `REWORK`
- DATA-003 — `REVIEWED-MINOR`
- DATA-002 — `CLOSED`

현재 canonical evidence에서 다섯 finding 중 DATA-003과 DATA-004가 `CLOSED`가 아니므로 PASS의
필수 선행 조건을 충족하지 않는다.

## Integrated Verification

### Signup

- full-flow: PASS — 실제 PostgreSQL에서 `requestOtp → verifyOtp → completeSignup` 성공,
  `CONSUMED` challenge와 ACTIVE Account/Profile/PasswordCredential 생성 확인
- rollback: PASS — 실제 PostgreSQL에서 Profile nickname 및 PasswordCredential email 충돌 각각에 대해
  challenge가 `VERIFIED`로 복원되고 Account/Profile insert가 rollback됨
- replay: PASS — 소비한 challenge의 재사용이 `OTP_NOT_VERIFIED`로 거부되고 identity row 수 불변

### OTP Concurrency

- concurrent first request: PASS — 실제 PostgreSQL 동시 요청 2개 중 성공 1개,
  `OTP_COOLDOWN` 1개, PENDING challenge 1행
- concurrent reissue: PASS — 성공 1개, `OTP_COOLDOWN` 1개, 기존 challenge INVALIDATED 및 신규 PENDING
- cooldown: PASS — loser는 EMAIL/IP counter를 소비하지 않음
- rate limits: PASS — email 5회 후 6번째, IP 20회 후 21번째가 `OTP_RATE_LIMITED`
- rollback: PASS — challenge insert 실패 시 두 counter와 challenge가 rollback되고 advisory lock 해제
- mail count: PASS — 최초/재발급 동시 요청 pair별 1회, rollback 시 0회

### Error Contract

- known 23505 -> 409: PASS — 실제 PostgreSQL에서 Album create/update slug와 signup email/nickname
  constraint가 각각 기존 conflict code 및 공개 409로 변환됨
- unrelated DB error -> 500: PASS — wrapper regression test에서 unknown constraint가 expected conflict로
  오분류되지 않고 generic 500 경로를 유지함
- conflict rollback: PASS — 실제 signup conflict 뒤 challenge와 identity row rollback 확인

### Sensitive Logging

- SQL: PASS — 실제 credential 23505 및 synthetic nested error marker가 최종 payload에 없음
- params: PASS — console/capture/tags/final event/HTTP body에서 제거됨
- email: PASS — 실제 PostgreSQL Drizzle error에 포함된 marker가 관측 payload에 없음
- password hash: PASS — 실제 PostgreSQL marker가 관측 payload에 없음
- OTP hash: PASS — synthetic nested error marker가 관측 payload에 없음
- IP: PASS — Sentry input의 private `user.ip_address`가 final allowlist event에서 제거됨
- safe event/source/type/code와 generic 500: PASS
- safe stack frame 위치 보존: FAIL — `sanitizeServerSentryEvent()`가 exception을 고정 type/value로
  재구성하며 filename/function/line/column을 포함한 안전한 frame도 모두 제거함
- structured JSON stdout: FAIL — `reportServerError()`가 JSON 문자열이 아닌 객체를
  `console.error()`에 전달하여 한 줄 structured JSON wire format을 보장하지 않음

### Upload Authorization

- guest: PASS — `UNAUTHENTICATED`, invalid/valid file 모두 storage 호출 0회
- USER: PASS — `FORBIDDEN`, invalid/valid file 모두 storage 호출 0회
- REVIEWER: PASS — `FORBIDDEN`, invalid/valid file 모두 storage 호출 0회
- ADMIN: PASS — validation 후 storage 호출 및 canonical URL 반환
- invalid FormData/MIME/size: PASS — storage 호출 전에 거부, 5 MiB exact boundary와 허용 MIME 4종 확인
- Action/storage boundary: PASS — RequestContext 위임, raw authorization/storage error 비노출,
  R2 helper의 server/storage 배치와 payload 계약 확인
- PostgreSQL: 해당 없음 — DATA-002는 schema/repository/transaction을 변경하지 않음

## PostgreSQL Verification

- local database guard: 4개 임시 DB 모두 `127.0.0.1`로 통과
- migration: 각 임시 DB에 tracked migration 4개 적용
- DATA-001: 1 file / 3 tests PASS
- DATA-003: 1 file / 4 tests PASS
- DATA-004: 1 file / 1 test PASS
- DATA-009: 1 file / 4 tests PASS
- 합계: 4 files / 12 tests PASS
- 종료 확인: 네 DB 모두 connection 0, advisory lock 0
- cleanup: 네 임시 DB를 명시적으로 drop했고 catalog 잔존 수 0 확인
- 기존 local application DB에는 연결하거나 migration/fixture를 적용하지 않았다.

## Focused Regression

- 대상: 다섯 finding의 직접 관련 tracked test 12개 파일
- 결과: 12 files / 53 tests PASS
- 포함 범위: consume payload, OTP lock/cooldown, signup conflict, Album conflict, safe logger/API/Auth.js/
  instrumentation, upload Service/Action/storage

## Repository Gates

- `pnpm type-check`: PASS
- `pnpm test:harness`: PASS — 7 tests
- `pnpm lint`: PASS
- `pnpm lint:fsd`: PASS — 문제 0개
- `pnpm test:unit:run`: PASS — 41 files / 154 tests
- `pnpm format:check`: PASS
- `pnpm build`: PASS — Next.js 16.3.3 production build, static pages 23개 생성
- `git diff --check`: PASS

## Remaining P0 Risks

1. DATA-004는 canonical review가 `REWORK`다. 현재
   `src/server/observability/safe-server-event.ts`의 final Sentry sanitizer가 안전한 stack frame 위치까지
   제거하여 동일 분류 오류의 발생 위치를 구분할 수 없다.
2. DATA-004의 server logger는 객체를 `console.error()`에 전달하므로 active observability 문서가 요구하는
   한 줄 structured JSON stdout을 보장하지 않는다. 현재 unit test는 mock argument를 사후
   `JSON.stringify()`하므로 이 wire-format 결함을 검출하지 않는다.
3. DATA-003의 코드 및 실제 PostgreSQL invariant는 통과했지만 canonical status가
   `REVIEWED-MINOR`이며, merge 전 PR 설명 보완과 최종 re-review가 기록되지 않아 `CLOSED` 요건을
   충족하지 않는다.

## Verdict

FAIL
