# M7-DATA-003

## Status

PLANNED

## PLAN

### Finding

M7-DATA-003 — Drizzle unique conflict mapping.

현재 `createAlbum`, `editAlbum`, `completeSignup`은 PostgreSQL unique constraint 충돌을
application conflict로 바꿀 때 outer `Error.message`에 constraint 이름이 포함되는지 검사한다.
실제 Drizzle 경로에서는 이 조건이 성립하지 않아 이미 정의된
`ALBUM_SLUG_ALREADY_EXISTS`, `EMAIL_ALREADY_REGISTERED`,
`NICKNAME_ALREADY_REGISTERED`가 HTTP 409까지 전달되지 않는다.

### Selected Model / Effort

Finding registry 권고는 다음과 같다.

```text
PLAN: Sol Medium
IMPLEMENT: Terra
REVIEW: Sol Medium
```

이 PLAN 실행에서 실제 runtime model/effort를 별도로 선택하거나 확인할 수 있는 근거는 없으므로
추정해 기록하지 않는다.

### Confirmed Cause

- `src/server/services/album-service.ts`의 create/update catch는 outer
  `error.message.includes("Album_slug_key")`만 검사한다.
- `src/server/services/signup-service.ts`의 catch도 outer message에서
  `password_credential_email_key`와 `profile_nickname_key`를 찾는다.
- 설치된 Drizzle ORM의 `DrizzleQueryError`는 outer message를 SQL과 params로 만들고 원래
  PostgreSQL 오류를 직접 `cause`에 보존한다. 실제 PostgreSQL 검증에서도 unique violation은
  `cause.code = "23505"`, `cause.constraint_name = <constraint>` 형태였고 기존 서비스 분기는
  이를 `AppError`로 바꾸지 못했다.
- 격리 PostgreSQL 17 검증에서 실제 Album slug 중복은 서비스 밖으로
  `DrizzleQueryError`로 전파됐고 `toErrorResponse`는 500을 반환했다. 같은 검증에서
  credential email과 profile nickname unique constraint가 SQLSTATE 23505와 정확한 constraint
  이름을 제공함을 확인했다.
- 세 constraint는 현재 Drizzle schema와 migration snapshot/SQL에 명시적인 이름으로 존재한다.
  Email/nickname 이름은 `schema.test.ts`에서도 고정되어 있다.
- 필요한 세 `AppError` code와 409 HTTP mapping은 이미 존재한다. 결함은 HTTP mapper나 schema가
  아니라 DB 오류를 expected application failure로 분류하는 service 경계에 있다.

### Invariant to Preserve

- known unique conflict만 expected `AppError`로 바꾼다. 조건은 SQLSTATE가 정확히 `23505`이고
  constraint 이름이 해당 use case가 허용한 이름과 정확히 일치하는 경우다.
- `Album_slug_key`는 `ALBUM_SLUG_ALREADY_EXISTS`,
  `password_credential_email_key`는 `EMAIL_ALREADY_REGISTERED`,
  `profile_nickname_key`는 `NICKNAME_ALREADY_REGISTERED`로 매핑한다.
- 다른 SQLSTATE, 알려지지 않은 unique constraint, DB connection failure, 깨진 invariant와
  programming error는 원래 exception을 유지하여 기존 unexpected 500 경로로 보낸다.
- Repository는 persistence exception을 그대로 throw하며 `AppError`, HTTP status, 사용자 메시지를
  알지 않는다. Expected failure 분류는 service가 소유한다.
- `AppError`에 HTTP status나 raw cause/SQL/params를 넣지 않는다. 현재 `toErrorResponse`의 안전한
  409 body와 DATA-004의 observability sanitization을 유지한다.
- cause 탐색은 실제로 확인된 `DrizzleQueryError -> direct cause` 한 단계로 제한한다. 재귀 탐색,
  outer message parsing, generic DB error framework를 도입하지 않는다.
- Signup transaction 소유권과 rollback, Album의 단일 SQL mutation 흐름, 기존 권한 검사를 유지한다.

### Options

1. 각 service에서 `DrizzleQueryError.cause`를 직접 검사한다. 수정량은 작지만 동일한 안전한 property
   판별과 SQLSTATE 검사가 create/edit/signup에 반복되고 이후 분기 간 조건이 달라질 수 있다.
2. `src/server/errors`에 direct Drizzle cause의 SQLSTATE와 constraint를 제한적으로 판별하는 작은
   helper를 두고 각 service가 자신이 아는 constraint와 `AppError` code를 명시한다. 중복을 줄이면서
   application 의미와 constraint allowlist를 service에 남긴다.
3. Repository에서 DB 오류를 `AppError`로 변환하거나 범용 DB error mapper/재귀 cause walker를 만든다.
   Repository 경계를 위반하고 확인되지 않은 오류까지 expected failure로 오분류할 수 있으므로 제외한다.

### Recommended Minimal Change

Option 2를 사용한다.

- `src/server/errors/postgres-error.ts`에 `isPostgresUniqueViolation(error, constraintName)` 형태의
  작은 predicate를 추가한다. 이름은 구현 시 현재 naming convention에 맞출 수 있지만 책임은
  하나여야 한다.
- Predicate는 값이 실제 `DrizzleQueryError`인지 확인하고 direct `cause`에서 안전하게 읽은
  `code === "23505"`와 `constraint_name === constraintName`만 true로 반환한다. Throwing getter나
  비객체 cause를 처리하되 더 깊은 cause를 순회하거나 message를 검사하지 않는다.
- `createAlbum`과 `editAlbum`은 helper로 `Album_slug_key`만 판별해 기존
  `ALBUM_SLUG_ALREADY_EXISTS`를 throw한다.
- `completeSignup`은 동일 helper로 email과 nickname constraint를 각각 판별해 기존 두
  `AppError`를 throw한다.
- 기존 `AppError` 계약과 `toErrorResponse` mapping은 이미 충분하므로 변경하지 않는다.

### Files Expected to Change

예상 변경 파일:

- `src/server/errors/postgres-error.ts` — 새 narrow predicate.
- `src/server/errors/postgres-error.test.ts` — 실제 `DrizzleQueryError` wrapper shape와 false cases.
- `src/server/services/album-service.ts` — create/edit의 message 검사를 helper 호출로 교체.
- `src/server/services/album-service.test.ts` — 새 service regression test.
- `src/server/services/signup-service.ts` — email/nickname message 검사를 helper 호출로 교체.
- `src/server/services/signup-service.test.ts` — 두 signup conflict와 unexpected error 회귀 test.
- `docs/migration/m7-foundation-fixes/DATA-003.md` — IMPLEMENTATION/VERIFICATION 기록 갱신.

명시적 제외 파일:

- `src/server/repositories/**`, `src/server/db/schema.ts`, `drizzle/**`: persistence 흐름과 DB schema,
  constraint 이름을 변경하지 않는다.
- `src/server/http/api-response.ts`, `src/shared/contracts/error.ts`, Route Handler: AppError code와 409
  mapping이 이미 존재하므로 수정하지 않는다.
- `src/server/observability/**`, `src/instrumentation.ts`, `sentry*.config.ts`: DATA-004에서 확립한
  관측 경계를 이 finding의 공용화 작업으로 다시 손대지 않는다.
- 영구적인 PostgreSQL test lifecycle/CI harness: DATA-008의 범위다. 이번 finding에서는 격리된
  실제 PostgreSQL 검증을 수행하고 그 결과를 canonical evidence에 기록한다.
- architecture/domain 문서와 migration SQL: 정책 또는 schema 변경이 아니다.

실제 구현 증거가 위 예상 범위를 벗어나는 변경을 요구하면 파일을 조용히 추가하지 않고 escalation
조건에 따라 중단한다.

### Tests Required

Unit/service regression:

- 실제 `DrizzleQueryError` 인스턴스에 direct cause `{ code: "23505",
  constraint_name: "Album_slug_key" }`를 넣으면 helper가 일치하는 constraint에만 true를 반환한다.
- 같은 constraint의 다른 SQLSTATE, SQLSTATE 23505의 알 수 없는 constraint, outer message에만
  constraint가 있는 오류, non-Error/throwing property/direct cause가 아닌 더 깊은 cause는 false다.
- `createAlbum`과 `editAlbum`의 실제 wrapper-shaped `Album_slug_key` 실패가
  `ALBUM_SLUG_ALREADY_EXISTS`가 된다.
- `completeSignup`의 `password_credential_email_key`와 `profile_nickname_key` 실패가 각각
  기존 email/nickname `AppError`가 된다.
- 각 service에서 unknown 23505와 unrelated error는 동일 error identity로 다시 throw되어 expected
  conflict로 오분류되지 않는다.
- 기존 성공, not-found, authorization, transaction orchestration tests를 보존한다. Route의 mock
  AppError 409 test만으로 이 finding을 검증했다고 판단하지 않는다.

우선 targeted test를 실행한 뒤 repository 기본 gate를 실행한다.

```bash
pnpm exec vitest run src/server/errors/postgres-error.test.ts src/server/services/album-service.test.ts src/server/services/signup-service.test.ts
pnpm type-check
pnpm test:harness
pnpm lint
pnpm lint:fsd
pnpm test:unit:run
pnpm format:check
pnpm build
```

### Actual PostgreSQL Verification

기존 2026-09-05 PostgreSQL 17 기록은 결함 재현과 세 constraint의 실제 23505 shape를 확인했지만,
수정 후 동작의 증거는 아니다. IMPLEMENT에서 다음 절차를 다시 수행해야 한다.

1. `compose.dev.yml`의 PostgreSQL 17 service가 healthy인지 확인한다.
2. 실행마다 고유한 임시 database를 만들고 명시적인 localhost URL로
   `scripts/assert-local-database.ts` guard를 통과시킨 뒤 tracked migration 0000~0003을 적용한다.
   기존 `oioibawige`와 production credential은 사용하거나 변경하지 않는다.
3. 실제 Drizzle/Repository/Service를 사용해 Album create duplicate와 update-to-duplicate를 각각
   발생시킨다. 두 오류가 `ALBUM_SLUG_ALREADY_EXISTS`이고 `toErrorResponse`가 안전한 409 body를
   반환하는지 확인한다.
4. VERIFIED challenge와 최소 identity fixture를 준비해 실제 `completeSignup`에서 기존 email과
   기존 nickname 충돌을 각각 발생시킨다. `EMAIL_ALREADY_REGISTERED`와
   `NICKNAME_ALREADY_REGISTERED`, 안전한 409 body를 확인한다.
5. 두 signup conflict 뒤 새 account/profile/credential이 남지 않고 challenge consume도 rollback되어
   VERIFIED 상태가 유지되는지 catalog/data query로 확인한다.
6. 알 수 없는 constraint의 23505와 다른 SQLSTATE가 helper를 통과하지 않으며
   `toErrorResponse`에서 generic 500이 되는 것은 wrapper unit에서 검증한다. 이를 위해 application
   schema에 test constraint를 추가하지 않는다.
7. 실행 명령, PostgreSQL/Drizzle 버전, assertion 결과와 한계를 이 문서의 VERIFICATION에 기록한다.
   임시 DB의 연결이 0개인지 확인한 뒤 명시적으로 drop하고 cleanup 결과도 기록한다.

메일, Sentry 등 외부 service는 호출하지 않는다. PostgreSQL 결과를 mock으로 대체하지 않는다.

### Risks / Unknowns

- Mapping은 명시적인 constraint 이름에 의존한다. 실제 catalog가 schema/migration에 기록된 세 이름과
  다르면 이 코드 수정으로 덮지 말고 schema drift로 escalation해야 한다.
- Drizzle 또는 PostgreSQL driver upgrade로 wrapper shape가 바뀌면 false negative가 발생할 수 있다.
  그래서 wrapper-shaped unit test와 실제 PostgreSQL 검증을 함께 요구한다.
- `instanceof DrizzleQueryError`가 현재 build/runtime 경계에서 안정적인지는 unit과 build로 확인한다.
  복수 module instance 때문에 실패한다는 실제 증거가 생기면 구조 판별로 임의 확장하지 않고 결정이
  필요하다.
- Signup duplicate는 transaction 중간에 발생한다. AppError mapping이 transaction rollback을 삼키지
  않는지 실제 row/challenge 상태로 확인해야 한다.
- DATA-004의 safe observability code에도 direct Drizzle cause 판별이 있으나 책임이 다르다. 이번에
  이를 추출·재사용하면 이미 검토된 관측 경계를 넓게 변경하므로 제외한다.
- 다음 중 하나가 확인되면 IMPLEMENT를 중단하고 escalation한다: direct cause가 아닌 추가 wrapper가
  실제 runtime에 존재함, constraint 이름 불일치, 추가 unique constraint의 제품 의미 결정 필요,
  schema/migration 변경 필요, repository 또는 HTTP contract 변경 필요, 격리 PostgreSQL 17에서 재현
  불가, DATA-004의 redaction/capture 회귀.

### Implementation Prompt

`M7-DATA-003`만 구현한다. Canonical plan은
`docs/migration/m7-foundation-fixes/DATA-003.md`다. 고정할 invariant는 SQLSTATE 23505와 해당
service가 명시한 known constraint 이름이 모두 정확히 일치할 때만 기존 conflict `AppError`로
변환하고, 나머지 오류는 원형 그대로 unexpected 500 경로에 남기는 것이다.

`src/server/errors/postgres-error.ts`와 unit test를 추가하고, direct
`DrizzleQueryError.cause` 한 단계만 안전하게 검사하는 narrow predicate를 구현한다. 이를
`album-service.ts`의 create/edit 및 `signup-service.ts`의 email/nickname 분기에 적용한다.
허용된 application/test 범위는 `src/server/errors/postgres-error{,.test}.ts`,
`src/server/services/album-service{,.test}.ts`, `src/server/services/signup-service{,.test}.ts`다.
Implementation/verification 기록을 위한 이 canonical evidence 파일 외에 repository, schema,
migration, HTTP mapper, contract, route, observability, architecture/domain 문서는 변경하지 않는다.

위 targeted tests, 전체 repository gate와 build를 실행한다. 별도의 PostgreSQL 17 임시 database에
tracked migration을 적용하고 실제 Album create/update slug 충돌 및 signup email/nickname 충돌이
AppError와 공개 409로 변환되는지 검증한다. Signup rollback과 임시 DB cleanup도 확인하고 실제
명령/결과를 canonical evidence에 기록한다. Production credential 또는 기존 local DB는 사용하지
않는다.

실제 오류가 direct cause shape가 아니거나 constraint 이름이 다르거나, 추가 mapping 정책 또는
schema/migration/repository/HTTP/observability 변경이 필요하면 구현 범위를 확대하지 말고 conflicting
evidence와 필요한 결정을 보고하며 중단한다.

## IMPLEMENTATION

pending

## VERIFICATION

pending

## REVIEW

pending
