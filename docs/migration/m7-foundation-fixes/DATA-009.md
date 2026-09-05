# M7-DATA-009

## Status

VERIFIED

## PLAN

### Finding

- Finding: `M7-DATA-009 — OTP first-request concurrency race`
- Registry classification: Transaction / `needs-fix` / medium (`P0`)
- Scope: 동일한 정규화 email에 대한 회원가입 OTP 최초 요청 및 재발급 요청의 직렬화만 다룬다.

### Selected Model / Effort

Registry recommendation:

| Phase | Model | Effort |
| --- | --- | --- |
| PLAN | Sol | XHigh |
| IMPLEMENT | Sol | High |
| REVIEW | Sol | High |

이 PLAN 세션에서 실제로 선택된 모델은 실행 환경에 표시된 `Codex (GPT-5)`이다. 실제 reasoning
effort 값은 세션에 노출되지 않아 추정하지 않는다. 위 표는 registry recommendation이며 실제 실행
모델을 뜻하지 않는다.

### Confirmed Cause

현재 `requestOtp` transaction은 다음 순서로 실행된다.

```text
findLatestChallengeForUpdate(email)
→ 60초 cooldown 검사
→ EMAIL/IP rate-limit upsert
→ 기존 PENDING challenge 무효화
→ 새 PENDING challenge insert
→ commit
→ mail 발송
```

`findLatestChallengeForUpdate`의 `SELECT ... FOR UPDATE`는 기존 challenge 행이 있을 때만 그 행을
잠근다. 동일 email의 최초 동시 요청에는 잠글 행이 없으므로 두 transaction이 모두 `undefined`를
읽고 cooldown을 통과할 수 있다. 이후 같은 시간 창의 EMAIL rate-limit upsert가 한 transaction을
대기시키더라도 cooldown decision은 이미 끝났기 때문에 재검사되지 않는다.

이 원인은 코드 추론에 그치지 않고 PostgreSQL에서 재현됐다. 2026-09-05의
`.local/M7-POSTGRES-VERIFICATION.md`는 PostgreSQL 17.11 임시 DB에서 두 실제 초기 SELECT가 모두
반환된 뒤 barrier를 해제하는 방식으로 동시성을 고정했다. 두 `requestOtp` 호출이 모두 성공했고 mail
spy가 2회 호출됐으며, 같은 email에 `INVALIDATED` 1행과 `PENDING` 1행이 남았다. DB query 결과는
mock하지 않았다.

### Invariant to Preserve

- Domain `AUTH-002`의 OTP 정책을 유지한다: 6자리 숫자, TTL 5분, 재전송 cooldown 60초, OTP당
  최대 5회 실패, 재발급 시 이전 OTP 즉시 무효화, email 시간당 5회, IP 시간당 20회.
- 동일한 정규화 email의 최초 요청과 재발급 요청이 겹치면 발급 transaction 하나만 성공하고 mail도
  1회만 발송한다. 나머지 요청은 새로 committed된 challenge를 본 뒤 `OTP_COOLDOWN`으로 실패한다.
- cooldown으로 거부된 요청은 현재 순서와 같이 EMAIL/IP rate-limit count를 소비하지 않는다.
- EMAIL/IP rate-limit의 `(scope, key, window_started_at)` 정책과 한도는 바꾸지 않는다.
- challenge 생성, rate-limit 증가, 이전 PENDING 무효화는 현재의 단일 top-level Service transaction
  안에 남긴다. Repository는 transaction을 시작하지 않고 전달받은 executor로 SQL만 실행한다.
- 메일은 transaction commit 이후에만 발송한다. transaction이 rollback되면 mail은 0회여야 한다.
  확정적 메일 실패 시 committed challenge를 무효화하는 현재 후처리도 유지한다.
- 서로 다른 email 요청 전체를 전역 직렬화하지 않는다.
- production credential과 production DB를 사용하지 않는다.

### Options

1. **기존 rate-limit 행을 cooldown보다 먼저 잠근다.** EMAIL counter upsert를 먼저 실행하면 같은
   시간 창의 `(EMAIL, email, window_started_at)` 행을 통해 요청이 직렬화되고, cooldown 예외의
   rollback으로 count도 복구된다. 그러나 두 요청의 `window_started_at`이 시간 창 경계 양쪽이면 서로
   다른 PK를 잠그므로 공통 직렬화 지점이 없다. Registry가 요구한 boundary-time race를 닫지 못해
   선택하지 않는다.
2. **정규화 email 기반 PostgreSQL transaction advisory lock을 먼저 획득한다.** 고정 namespace와
   정규화 email로 64-bit key를 만들고 `pg_advisory_xact_lock`을 transaction 첫 DB 연산으로 실행한다.
   challenge 존재 여부와 rate-limit 시간 창에 의존하지 않으며 commit/rollback 때 자동 해제된다.
   새 schema나 migration이 필요 없는 가장 작은 변경이므로 선택한다.
3. **전용 stable lock row/table을 추가한다.** email별 행을 upsert한 뒤 row lock을 잡으면 hash collision
   없이 정확히 직렬화할 수 있다. 그러나 새 table, migration, 보존/정리 정책과 운영 관찰 대상이
   필요하다. 현재 finding에 비해 변경 범위가 크므로 advisory lock을 운영상 사용할 수 없을 때만
   재검토한다.
4. **transaction ordering 또는 isolation만 변경한다.** 기존 challenge read/write 순서만 바꿔서는
   최초 요청의 빈 집합을 잠글 수 없다. `SERIALIZABLE`과 serialization failure retry를 결합할 수는
   있지만 retry 및 오류 매핑 정책까지 새로 정해야 하고 OTP transaction 전체의 동작 범위를 넓힌다.
   최소 수정으로 선택하지 않는다.

### Recommended Minimal Change

1. `email-verification-repository.ts`에 전달받은 executor로 PostgreSQL transaction advisory lock을
   획득하는 한 개의 구체 함수만 추가한다. lock key는 고정된 OTP request namespace와 정규화 email을
   `hashtextextended` 등 PostgreSQL의 64-bit hash로 변환해 만들고, 시간 창·IP·challenge id는 포함하지
   않는다. 범용 lock abstraction이나 framework를 만들지 않는다.
2. `requestOtp`의 기존 Service-owned transaction에서 이 함수를 첫 DB 연산으로 호출하고, lock 획득
   뒤에 `findLatestChallengeForUpdate`와 cooldown decision을 실행한다. lock 대기로 시간이 흐를 수
   있으므로 TTL, `lastSentAt`, cooldown 및 rate-limit window에 사용하는 decision time은 lock 획득
   후 계산한다.
3. 기존 `findLatestChallengeForUpdate(... FOR UPDATE)`, EMAIL/IP counter 순서, PENDING 무효화,
   challenge insert와 commit 이후 메일 발송 흐름은 유지한다. 기존 row lock을 제거하거나 다른
   발급 정책을 함께 정리하지 않는다.
4. advisory lock 호출은 반드시 현재 transaction executor로 수행한다. transaction 밖의 database
   executor에서 호출하면 statement 종료와 함께 효과가 사라질 수 있으므로 Service call site와 테스트로
   transaction 내부 사용을 고정한다.

### Files Expected to Change

Expected tracked files during IMPLEMENT:

- `src/server/repositories/email-verification-repository.ts`
- `src/server/services/email-verification-service.ts`
- `src/server/services/email-verification-service.test.ts`
- `docs/migration/m7-foundation-fixes/DATA-009.md`의 IMPLEMENT/VERIFICATION 기록

PostgreSQL 재검증을 위한 일회성 test/config/evidence는 `.local/`에 둘 수 있으나 commit 대상에 넣지
않는다.

Excluded files and areas:

- `src/server/db/schema.ts`, `drizzle/*.sql`, Drizzle journal 및 새 migration
- Route Handler, shared contract, client query/form/UI, mail delivery adapter
- active architecture 문서와 `DOMAIN_SPECIFICATION.md`
- 범용 lock/repository/transaction abstraction, DI container, retry framework
- DATA-008이 소유할 전체 PostgreSQL integration-test/CI infrastructure 구축
- DATA-001부터 DATA-008까지의 다른 finding 수정

### Tests Required

Tracked automated tests:

- Service unit test에서 정규화 email의 advisory lock 획득이 latest challenge read/cooldown decision보다
  먼저 일어남을 검증한다.
- lock 이후 발견한 60초 이내 challenge가 `OTP_COOLDOWN`을 발생시키며 EMAIL/IP counter,
  invalidate, insert, mail을 실행하지 않는지 검증한다.
- 기존 성공 응답이 OTP를 노출하지 않고 commit 뒤 생성된 OTP를 mail에 전달하는 테스트와 메일 실패
  테스트를 유지한다.

Mock unit test는 실제 lock 또는 concurrency 증거로 사용하지 않는다. 아래 PostgreSQL 동시성 검증이
필수다.

Implementation repository gates:

```bash
pnpm type-check
pnpm test:harness
pnpm lint
pnpm lint:fsd
pnpm test:unit:run
pnpm format:check
pnpm build
```

### Actual PostgreSQL Verification

Baseline evidence는 PostgreSQL 17.11에서 결함을 실제 재현했다. 수정 후에는 production credential을
사용하지 않고 Docker Compose PostgreSQL 17의 고유한 임시 DB를 생성해 local database guard를
통과한 뒤 현재 migration을 명시적으로 적용한다. 외부 mail 전송만 spy로 대체하고 DB/Repository/
Service/transaction은 실제 구현을 사용한다.

필수 시나리오:

1. **동일 email 최초 동시 요청:** 첫 transaction이 advisory lock을 획득한 상태에서 두 번째 요청이
   같은 lock 획득을 시도하도록 barrier를 둔다. 결과는 fulfilled 1건, `OTP_COOLDOWN` rejected 1건,
   mail 1회, `PENDING` challenge 1행이어야 한다. 두 요청의 DB read/result를 mock하지 않는다.
2. **동일 email 재발급 동시 요청:** cooldown이 지난 기존 challenge fixture에서 두 요청을 겹친다.
   fulfilled 1건, `OTP_COOLDOWN` 1건, 해당 pair의 mail 1회, 기존 challenge `INVALIDATED`, 신규
   challenge `PENDING`을 확인한다.
3. **rate-limit 보존:** cooldown loser가 EMAIL/IP count를 증가시키지 않고 winner만 각 count 1을
   남기는지 확인한다. 별도 fixture에서 email 5회/시간, IP 20회/시간 한도와 다음 요청의
   `OTP_RATE_LIMITED`를 확인한다.
4. **rollback:** transaction 내부 challenge insert를 실제 PostgreSQL 오류로 실패시키고 EMAIL/IP
   counter 및 challenge가 모두 rollback되며 mail이 0회인지 확인한다.
5. advisory key가 rate-limit `window_started_at`을 입력으로 사용하지 않아 시간 창 경계에서도 동일
   email이 같은 serialization key를 사용함을 확인한다.

검증 종료 후 임시 DB의 연결을 닫고 삭제하며, 실행 명령·PostgreSQL 버전·결과·한계를 이 문서의
VERIFICATION에 기록한다. 기존 local DB와 production DB에는 migration이나 fixture를 적용하지 않는다.

### Risks / Unknowns

- 64-bit hash collision이 발생하면 서로 다른 email이 잠시 직렬화될 수 있다. 이는 cooldown 판단을
  섞지는 않지만 성능상 false contention이다. collision을 전혀 허용할 수 없다는 운영 요구가 있으면
  전용 lock table과 migration 결정으로 escalation한다.
- PostgreSQL advisory lock은 협력적 잠금이다. 현재 검색에서 OTP 발급 writer는 `requestOtp` 하나지만,
  IMPLEMENT 중 다른 challenge 발급 경로가 확인되면 같은 protocol에 포함할지 결정하기 전 중단한다.
- transaction-level lock이 실제 Drizzle transaction connection에서 유지되는지는 PostgreSQL 통합
  검증으로 확인해야 한다. connection/pool 환경에서 대기와 자동 해제가 증명되지 않으면 완료하지 않는다.
- lock 대기 뒤 시간을 다시 계산하면 기존처럼 transaction 시작 전 시간을 쓰는 것과 수 밀리초 이상의
  차이가 생길 수 있다. 이는 TTL/cooldown/window를 실제 발급 decision 시점에 맞추기 위한 의도된
  변경이다. 이 기준이 제품 정책과 충돌한다면 구현 전에 escalation한다.
- advisory lock 사용을 금지하는 DB 권한 또는 운영 정책, 정확한 collision-free key 요구, schema 기반
  잠금 감사 요구가 확인되면 전용 stable lock table 옵션으로 전환하기 위한 별도 승인이 필요하다.

현재 확인된 evidence에서는 Domain/architecture policy 변경이나 schema migration이 필요하지 않아
즉시 해결해야 할 escalation은 없다.

### Implementation Prompt

```text
Implement exactly M7-DATA-009 from
docs/migration/m7-foundation-fixes/DATA-009.md. Do not implement another finding.

Decision to apply after plan approval:
- Preserve AUTH-002: 60-second resend cooldown, invalidation on reissue, email 5/hour,
  IP 20/hour, and mail only after commit.
- Serialize every requestOtp transaction for the same normalized email before reading the
  latest challenge.
- Add one concrete repository operation using PostgreSQL transaction advisory locking with
  a fixed OTP-request namespace plus normalized email mapped to a 64-bit key.
- Call it as the first DB operation inside the existing Service-owned transaction.
- Compute the issuance decision time after acquiring the lock, then retain the existing
  latest-row cooldown check, EMAIL/IP counters, invalidation, insert, and post-commit mail flow.
- Do not add a schema change, migration, generic lock abstraction, retry framework, or global
  serialization. Do not edit routes, contracts, UI, architecture/domain documents, or other
  M7 findings.

Allowed tracked scope:
- src/server/repositories/email-verification-repository.ts
- src/server/services/email-verification-service.ts
- src/server/services/email-verification-service.test.ts
- docs/migration/m7-foundation-fixes/DATA-009.md for implementation and verification evidence

Tests and verification:
- Add meaningful Service tests for lock-before-read and the cooldown short-circuit.
- Run pnpm type-check, pnpm test:harness, pnpm lint, pnpm lint:fsd,
  pnpm test:unit:run, pnpm format:check, and pnpm build.
- Against an isolated Docker Compose PostgreSQL 17 temporary DB with current migrations,
  run actual concurrent first-request and reissue tests. Assert one success, one
  OTP_COOLDOWN, and one mail per pair; preserve email/IP limits; prove rollback sends no mail.
  Mock only external mail delivery, not DB/Repository/Service results. Clean up the DB and
  record exact commands, versions, results, and limitations in VERIFICATION.

Stop and escalate if another OTP issuance writer bypasses the protocol, advisory locks are
unavailable or prohibited, the 64-bit collision tradeoff is rejected, a schema/migration is
required, transaction-scoped connection behavior cannot be demonstrated, or any evidence
conflicts with the invariants above.
```

## IMPLEMENTATION

### Changed Files

- `src/server/repositories/email-verification-repository.ts`
- `src/server/services/email-verification-service.ts`
- `src/server/services/email-verification-service.test.ts`
- `docs/migration/m7-foundation-fixes/DATA-009.md`

### Implemented Decision

- `acquireOtpRequestLock(Transaction, email)`을 추가했다. 고정 namespace
  `oioi-bwg:signup-otp`와 정규화 email을 PostgreSQL `hashtextextended`로 64-bit key로 만들고
  `pg_advisory_xact_lock`을 획득한다.
- `requestOtp`의 기존 Service-owned transaction 첫 DB 연산으로 lock을 획득한 뒤 latest challenge와
  cooldown을 검사한다. 발급 decision time은 lock 획득 뒤 계산한다.
- EMAIL/IP counter, 이전 PENDING 무효화, challenge insert, commit 이후 mail 발송 흐름은 유지했다.
  schema, migration, contract, route, UI 및 범용 lock abstraction은 변경하지 않았다.
- Plan deviation: 없음.

### Tests Added

- Service unit test에 정규화 email lock이 latest challenge read보다 먼저 실행되는 검증을 추가했다.
- lock 이후 cooldown이 확인되면 counter, invalidate, insert, mail을 모두 건너뛰는 검증을 추가했다.
- `.local/m7-data-009-verification.test.ts`에서 실제 PostgreSQL 최초 요청/재발급 동시성,
  email/IP 한도, rollback 및 transaction lock 해제를 검증했다. 이 일회성 파일은 commit하지 않는다.

### Commands Run

```text
pnpm exec prettier --write <3 changed TypeScript files>
pnpm test:unit:run -- src/server/services/email-verification-service.test.ts
pnpm type-check
docker compose -f compose.dev.yml ps postgres
docker compose -f compose.dev.yml exec -T postgres createdb -U oioibawige m7_data_009_20260906_0345
DATABASE_URL=<isolated-local-url> node --import tsx scripts/assert-local-database.ts
M7_DATA_009_DATABASE_URL=<isolated-local-url> node node_modules/vitest/vitest.mjs run --config .local/m7-data-009-verification.config.ts --reporter=verbose
docker compose -f compose.dev.yml exec -T postgres psql ... "show server_version"
docker compose -f compose.dev.yml exec -T postgres psql ... <migration/lock/row and connection checks>
docker compose -f compose.dev.yml exec -T postgres dropdb -U oioibawige m7_data_009_20260906_0345
pnpm test:harness
pnpm lint
pnpm lint:fsd
pnpm test:unit:run
pnpm format:check
pnpm build
git diff --check
```

Credential-bearing local URL 값은 문서에서 생략했다.

### Results

- 구현 세션 실제 모델: `Codex (GPT-5)`; reasoning effort는 노출되지 않아 추정하지 않았다.
  Registry IMPLEMENT recommendation은 `Sol / High`이다.
- targeted 명령도 Vitest 설정상 전체 unit suite를 실행했으며 34 files / 111 tests가 통과했다.
- 전체 gate: type-check, harness 7 tests, lint, FSD lint, unit 34 files / 111 tests,
  format check, Next.js production build가 모두 통과했다.
- PostgreSQL 17.11 실검증 1 file / 4 tests가 통과했고 임시 DB를 삭제했다. 실패한 검증은 없다.

### Remaining Unknowns

- 64-bit hash collision은 서로 다른 email 사이의 희박한 false contention 가능성으로 남는다. correctness
  위반은 아니며 collision-free 요구가 생기면 전용 lock table 결정을 다시 해야 한다.
- 운영 DB 권한과 실제 트래픽에서의 contention/latency는 production을 사용하지 않았으므로 측정하지
  않았다. 로컬 PostgreSQL의 여러 connection 사이 대기와 commit/rollback 자동 해제는 확인했다.

### Diff Review Packet

```text
finding: M7-DATA-009 — OTP first-request concurrency race
plan 핵심: 정규화 email의 transaction advisory lock을 cooldown read 전에 획득
changed files: Repository 1, Service 1, Service test 1, canonical evidence 1
git diff summary: application/test 3 files, +37/-3; evidence는 PLAN을 유지하고 실행 결과만 추가
test results: repository gates 전체 통과, PostgreSQL 17.11 concurrency/limit/rollback 4 tests 통과
known risks: 64-bit hash collision의 희박한 false contention, production latency 미측정
```

## VERIFICATION

VERIFIED

- 임시 DB: `m7_data_009_20260906_0345`, Docker Compose PostgreSQL
  `17.11 (Debian 17.11-1.pgdg13+2)`.
- local database guard 통과 후 Drizzle migration 4개를 새 임시 DB에 적용했다. 기존 local application
  DB와 production DB에는 migration, fixture, write를 실행하지 않았다.
- 동일 email 최초 동시 요청 두 개가 같은 advisory lock에서 실제로 대기 중임을 `pg_locks`로 확인한
  뒤 holder를 해제했다. 결과는 성공 1건, `OTP_COOLDOWN` 1건, mail 1회, PENDING 1행,
  EMAIL/IP count 각 1이었다.
- cooldown이 지난 기존 PENDING challenge의 재발급 동시 요청도 성공 1건, `OTP_COOLDOWN` 1건,
  mail 1회였고 기존 행은 INVALIDATED, 신규 행은 PENDING이었다.
- email은 시간당 5회 성공 후 6번째가 `OTP_RATE_LIMITED`, IP는 20회 성공 후 21번째가
  `OTP_RATE_LIMITED`였다. 거부 transaction의 counter는 rollback됐다.
- 잘못된 PostgreSQL `inet` 값으로 challenge insert를 실패시켰을 때 challenge와 두 counter가 모두
  rollback되고 mail은 0회였다. 같은 email의 다음 정상 요청 성공으로 advisory lock 자동 해제도
  확인했다.
- lock key 입력은 고정 namespace와 정규화 email뿐이며 rate-limit 시간 창을 포함하지 않는다.
  검증 종료 시 advisory lock 0개와 DB connection 0개를 확인했고 임시 DB 삭제 후 catalog에서
  존재하지 않음을 확인했다.
- 자동 검증과 build 실패 없음. REVIEW만 `pending`이다.

## REVIEW

pending
