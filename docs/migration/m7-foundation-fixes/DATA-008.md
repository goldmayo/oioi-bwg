# M7-DATA-008

## Status

PLANNED

## PLAN

### Finding

- Finding: `M7-DATA-008 — Real DB/security test coverage`
- Registry classification: Testing / `partial` / high (`P0` 보강)
- Registry recommendation: M7 전체 test suite를 다시 설계하지 않고 foundation P0 위험만 실제
  PostgreSQL regression으로 보호한다.
- Canonical input: `migration_m7-final-verification`의 commit
  `49f33c403c894c1562de1453cdabd0472933df3b` 및 PR #69에 기록된
  `docs/migration/m7-foundation-fixes/M7-FINAL-VERIFICATION.md`의 FAIL 판정이다.
- Scope: 현재 `.local` 수동 검증에서만 재현 가능한 P0 시나리오를 fresh checkout과 CI에서 실행할 수
  있는 작은 tracked lifecycle로 전환한다. application behavior나 Service/Repository 구조는 바꾸지
  않는다.

### Selected Model / Effort

Registry recommendation:

| Phase | Model | Effort |
| --- | --- | --- |
| PLAN | Sol | High |
| IMPLEMENT | Terra | registry에 별도 effort 지정 없음 |
| REVIEW | Sol | High |

이 PLAN 세션에서 모델 또는 reasoning effort를 별도로 override하지 않았다. 실제 runtime model/effort
metadata는 실행 환경에 노출되지 않았으므로 추정하지 않는다. 위 표는 registry recommendation이며
실제 실행값을 뜻하지 않는다.

### Confirmed Cause

최종 검증에서 현재 integrated source의 기능·보안·데이터 정합성 regression은 발견되지 않았다.
PostgreSQL 17.11의 finding별 격리 DB 6개에서 6 files / 23 tests가 통과했고 signup transaction,
OTP concurrency, known conflict, privileged Service authorization, persistence와 public read를 확인했다.

그러나 그 PostgreSQL test와 Vitest config는 모두 `.gitignore`의 `/.local/` 아래에 있다. tracked
`vitest.config.ts`는 `src/**/*.test.{ts,tsx}`만 실행하고, `package.json`에는 PostgreSQL integration
command가 없으며, `.github/workflows/verify.yml`에는 PostgreSQL service와 integration step이 없다.
따라서 fresh checkout과 CI는 해당 evidence를 재현할 수 없고 이후 PR이 같은 경로를 깨뜨려도 현재
merge gate는 검출하지 못한다.

직접 원인은 application defect가 아니라 다음 test lifecycle 누락이다.

```text
ignored .local verification
→ tracked test/config 없음
→ temp DB create/migrate/cleanup command 없음
→ CI PostgreSQL 17 service/step 없음
→ M7 P0 결과가 지속 가능한 repository regression이 아님
```

DATA-008 canonical PLAN/IMPLEMENT/VERIFICATION/REVIEW 기록도 없어서 finding completion rule을 충족하지
못한다. 이 계획은 두 누락 중 tracked lifecycle을 구현하고 같은 파일에 evidence를 축적하는 데 한정한다.

### Invariant to Preserve

- `AUTH-002`의 `PENDING → VERIFIED → CONSUMED` 흐름, signup 성공 시 ACTIVE Account/Profile/
  PasswordCredential 생성, 소비된 challenge 재사용 거부를 유지한다.
- signup의 challenge consume과 identity 생성은 하나의 Service-owned transaction이다. Profile 또는
  PasswordCredential의 실제 unique violation이 발생하면 challenge는 `VERIFIED`로 복원되고 모든 중간
  identity insert가 rollback되어야 한다.
- 동일한 정규화 email의 최초 및 재발급 동시 OTP 요청은 각각 성공 1건,
  `OTP_COOLDOWN` 1건, mail 1회만 허용한다. loser는 EMAIL/IP counter를 소비하지 않고 재발급 시 기존
  PENDING은 `INVALIDATED`, winner의 신규 challenge만 `PENDING`이어야 한다.
- known PostgreSQL `23505` constraint만 각 Service allowlist의 domain `AppError`와 공개 409로 변환한다.
  최소 mapping 대상은 Album slug create/update, Song slug, signup nickname/email이다.
- Album/Song privileged Service의 최종 보안 경계는 UI나 Route mock이 아니라 실제
  `RequestContext → requireUser/CASL → Service`다. guest/USER/REVIEWER는 모든 privileged entry에서
  DB mutation 전에 거부되어야 한다.
- tracked migration `0000`~`0004`를 빈 PostgreSQL 17 DB에 순서대로 적용한다. Album/Song의 global
  unique, Album FK, delete cascade, Song order, visibility와 JSONB lyrics public projection을 유지한다.
- Service가 transaction을 소유하고 Repository는 전달된 `DbExecutor`를 사용하는 현재 architecture를
  바꾸지 않는다. test를 위해 Generic Repository, DI container, DB framework를 만들지 않는다.
- 외부 mail delivery만 deterministic spy로 대체할 수 있다. DB, Repository, transaction, CASL 및
  Service result를 mock한 결과는 PostgreSQL integration 성공으로 기록하지 않는다.
- production credential/DB, 기존 local application DB, `.local` 파일에 연결하거나 의존하지 않는다.
  test fixture와 migration은 고유한 임시 DB에만 적용한다.

### Options

1. **기존 `.local` finding suite 5~6개를 그대로 tracked 위치로 이동한다.** 이미 검증한 시나리오를 거의
   그대로 보존할 수 있지만 migration/setup과 fixture가 중복되고 20개가 넘는 P0/P1/P2 진단까지 CI에
   실린다. journal count처럼 finding 당시의 고정값도 쉽게 stale해지므로 선택하지 않는다.
2. **foundation PostgreSQL test를 한 tracked file의 두 logical suite로 압축하고 DATA-008 전용 lifecycle
   runner를 둔다.** auth/signup/OTP와 content/authz/persistence를 `describe` 단위로 구분하되 DB client와
   fixture lifecycle은 한 파일에서 한 번만 소유한다. 기존 `db:migrate`와 local guard를 재사용하고 CI는
   같은 runner를 호출한다. 파일 병렬화와 global DB singleton 정리를 단순화하는 최소안이므로 선택한다.
3. **testcontainers 또는 범용 ephemeral-DB library를 도입한다.** container와 cleanup을 코드로 캡슐화할
   수 있지만 새 dependency, Docker orchestration abstraction과 유지보수 범위가 생긴다. 기존 Compose와
   GitHub Actions service로 충분하므로 선택하지 않는다.
4. **각 Vitest test가 transaction rollback으로 isolation을 얻도록 공통 DB test framework를 만든다.**
   production transaction 경계를 test wrapper와 중첩시키고 concurrency/cascade/commit 이후 동작을
   왜곡할 수 있다. 고유한 DB와 deterministic fixture만으로 충분하므로 선택하지 않는다.

### Recommended Minimal Change

#### 1. Tracked PostgreSQL suite

`tests/integration/m7-foundation.postgres.test.ts` 한 파일에 두 개의 sequential `describe`를 둔다.
`.local` 파일을 import하지 않고, 검증된 fixture와 assertion만 필요한 만큼 옮긴다.

**Auth / signup / OTP suite**

1. `AUTH-T001` signup success: 실제 `requestOtp → verifyOtp → completeSignup`을 실행하고 challenge의
   `PENDING → VERIFIED → CONSUMED`, ACTIVE Account, Profile, verified PasswordCredential을 확인한다.
   같은 challenge replay가 `OTP_NOT_VERIFIED`이고 identity row를 추가하지 않는 assertion을 같은
   scenario에 둔다.
2. signup late rollback + known conflict:
   - 기존 nickname 때문에 Profile insert가 실패하면 `NICKNAME_ALREADY_REGISTERED`/409이고 challenge와
     Account가 rollback되는지 확인한다.
   - 기존 email 때문에 마지막 PasswordCredential insert가 실패하면 `EMAIL_ALREADY_REGISTERED`/409이고
     challenge, Account, Profile이 모두 rollback되는지 확인한다.
   두 실제 `23505`는 DATA-001 transaction 위치와 DATA-003의 서로 다른 constraint mapping을 함께
   보호하므로 하나로 줄이지 않는다.
3. OTP state/concurrency: 실제 advisory-lock 대기를 관찰하는 barrier로 동일 email의 최초 요청과
   cooldown이 지난 재발급 요청을 각각 겹친다. 각 pair에서 fulfilled 1, `OTP_COOLDOWN` 1, mail 1,
   winner EMAIL/IP count 1을 확인한다. 최초에는 PENDING 1행, 재발급에는 기존 INVALIDATED 1행과 신규
   PENDING 1행을 확인한다. 시간당 limit 전체 반복과 invalid `inet` 진단은 기존 tracked unit coverage와
   수동 evidence에 남기며 이 최소 CI suite에는 중복하지 않는다.

**Content / authorization / persistence suite**

4. migration baseline: PostgreSQL major version 17, migration journal 5행과 `0000`~`0004` SQL hash가
   tracked journal과 일치함을 확인한다. schema 전체 snapshot 복제는 하지 않는다.
5. known conflict mapping: 실제 Album slug create/update와 Song global non-null slug collision이 각각
   `ALBUM_SLUG_ALREADY_EXISTS`/`SONG_SLUG_ALREADY_EXISTS`와 공개 409가 되는지 확인한다. nullable Song
   slug 여러 행은 허용되는지도 같은 persistence fixture에서 확인한다.
6. privileged Service direct denial: guest/USER/REVIEWER context로 Album/Song privileged Service 10개를
   직접 호출해 `UNAUTHENTICATED`/`FORBIDDEN`을 확인한다. `requireUser`, CASL 또는 Service를 mock하지 않고
   denial 전후 row count가 불변인지 확인한다.
7. critical persistence/public read: 실제 Album과 Song을 insertion order와 다른 `order`로 저장하고 hidden
   Song 및 hidden parent fixture를 둔다. public Album/Song Service가 visible data만 순서대로 반환하고
   JSONB lyrics를 round-trip하는지 확인한다. 존재하지 않는 Album FK insert의 `23503`과 transaction
   rollback, Album delete 후 Song cascade를 확인한다.

test file은 `DATABASE_URL` hostname이 `localhost`/`127.0.0.1`이고 database name이
`oioi_m7_test_` prefix인지 다시 검사한다. Node environment에서 file parallelism을 끄고 한 worker에서
실행하며 `afterAll`에서 직접 만든 SQL client와 `getDatabase().$client`를 명시적으로 닫는다. mail만
hoisted spy로 대체하고 고정된 test-only `AUTH_SECRET`을 사용한다.

#### 2. Repository lifecycle command

`scripts/run-postgres-integration-tests.ts`는 DATA-008에만 필요한 얇은 orchestration script다. 범용 DB
test API를 export하지 않는다.

```text
local: pnpm test:integration:postgres:local
  → docker compose -f compose.dev.yml up -d --wait postgres
  → DATA-008 runner --local

CI/existing service: pnpm test:integration:postgres
  → M7_TEST_POSTGRES_ADMIN_URL의 PostgreSQL 17 service 사용

runner
  → admin URL이 localhost/127.0.0.1이고 admin DB가 postgres인지 확인
  → SHOW server_version_num으로 major 17 확인
  → oioi_m7_test_<timestamp>_<random> 고유 DB 생성
  → DATABASE_URL을 child-process environment로만 전달
  → pnpm db:migrate 실행: 기존 local guard 통과 후 tracked 0000~0004 적용
  → vitest run --config vitest.postgres.config.ts 실행
  → test process의 DB clients 종료 확인
  → 해당 temp DB의 active connection/advisory lock 0 확인
  → DROP DATABASE 및 catalog 부재 확인
```

runner는 URL/password를 argv나 stdout/stderr에 출력하지 않는다. child process는 shell interpolation 없이
인자 배열과 environment로 실행한다. migration/test 실패에도 `finally`에서 cleanup을 수행한다. 연결 또는
lock 잔존, DROP 실패, drop 후 catalog 잔존은 원래 test 결과와 무관하게 최종 exit code를 non-zero로
만든다. 잔존 connection 때문에 정상 DROP이 실패하면 생성한 prefix의 정확한 DB만 best-effort force
drop하되 cleanup failure는 숨기지 않는다. SIGINT/SIGTERM도 같은 cleanup 경로를 요청한다.

local command는 기존 Compose PostgreSQL service를 종료하지 않는다. 다른 개발 작업을 중단시키지 않고
이 command가 생성한 임시 DB만 삭제한다. `M7_TEST_POSTGRES_ADMIN_URL`이 없는 일반 command는 임의의
`.env`/application `DATABASE_URL`로 fallback하지 않고 실패한다. `--local` 경로만 tracked
`compose.dev.yml`의 dev-only 접속값을 process 내부에서 사용한다.

#### 3. Vitest config

root의 `vitest.postgres.config.ts`는 기존 alias 중 `@`와 `server-only`만 재사용하고 다음을 고정한다.

- `environment: "node"`
- include: `tests/integration/m7-foundation.postgres.test.ts` 한 파일
- file parallelism off, one worker, sequential execution
- 실제 concurrency 대기를 허용하는 명시적 hook/test timeout
- jsdom/setupFiles/CSS/coverage 및 `.local` dependency 없음

#### 4. CI integration

기존 `.github/workflows/verify.yml`의 단일 `verify` job에 ephemeral PostgreSQL service를 추가한다.

- image는 floating major가 아닌 `postgres:17`을 사용한다.
- 초기 DB/user는 CI 전용이고 `POSTGRES_HOST_AUTH_METHOD=trust`를 ephemeral runner에만 적용해 password를
  만들거나 로그에 전달하지 않는다. host port는 job runner의 `127.0.0.1:5432`만 사용한다.
- healthcheck가 통과한 뒤 `M7_TEST_POSTGRES_ADMIN_URL=postgresql://postgres@127.0.0.1:5432/postgres`로
  `pnpm test:integration:postgres`를 실행한다.
- 순서는 install → 기존 `pnpm verify` → PostgreSQL integration → `pnpm format:check`로 유지한다.
- production secret/context, `.env.local`, 기존 application DB, network mail/R2/Sentry에 의존하지 않는다.
- 별도 artifact upload를 추가하지 않는다. 실패 로그에는 단계명, PostgreSQL major, temp DB 식별자와
  sanitized test failure만 남기고 URL, password, OTP/hash 또는 raw SQL parameter를 기록하지 않는다.

`pnpm verify` 자체에 DB suite를 넣지 않는다. DB service 없이 사용하던 unit/structure command의 계약을
깨지 않고 CI가 별도 명시 step으로 둘 다 required gate로 실행한다.

### Files Expected to Change

Expected tracked files during IMPLEMENT:

- `tests/integration/m7-foundation.postgres.test.ts` — 압축된 P0 actual PostgreSQL regression
- `vitest.postgres.config.ts` — Node/sequential 전용 config
- `scripts/run-postgres-integration-tests.ts` — create/guard/migrate/test/cleanup lifecycle
- `package.json` — `test:integration:postgres`, `test:integration:postgres:local` scripts
- `.github/workflows/verify.yml` — PostgreSQL 17 service와 deterministic integration step
- `docs/migration/m7-foundation-fixes/DATA-008.md` — IMPLEMENT/VERIFICATION/REVIEW evidence

새 runtime dependency와 lockfile 변경은 예상하지 않는다. 현재 `postgres`, `tsx`, `vitest`, Drizzle과
Docker Compose를 재사용한다.

Excluded files and areas:

- `src/server/services/**`, `src/server/repositories/**`, `src/server/db/schema.ts`
- `drizzle/*.sql`, snapshots, journal 및 production migration
- Route Handler, shared contract, client Query/form/UI
- `vitest.config.ts`의 unit/coverage scope와 P2 coverage cleanup
- Playwright config/spec, browser E2E, k6/load test
- generic DB fixture/framework, testcontainers dependency, seed system
- active architecture 문서와 `DOMAIN_SPECIFICATION.md`
- `.local/**`의 추적, 삭제 또는 canonical source 승격

실제 test가 application regression을 발견하면 위 excluded production file을 즉시 수정하지 않는다.
DATA-008 implementation을 멈추고 해당 behavior finding의 별도 PLAN/승인을 요청한다.

### Tests Required

Tracked PostgreSQL scenarios:

| P0 protection | Required assertion |
| --- | --- |
| signup success | `AUTH-T001`, PENDING→VERIFIED→CONSUMED, ACTIVE identity 3종, replay 거부 |
| signup late rollback | nickname/email 실제 23505 후 VERIFIED 복원과 중간 identity row 0 |
| OTP state/concurrency | 최초/재발급 pair별 success 1, cooldown 1, mail 1, winner counter/state |
| known conflict | Album create/update, Song slug, signup nickname/email domain code + HTTP 409 |
| privileged denial | guest/USER/REVIEWER × Album/Song privileged Service 10개, mutation 0 |
| persistence | PG17, migration 5/hash, nullable/global unique, FK 23503+rollback, cascade, order |
| public read | visible-only Album/Song, hidden parent/song 차단, JSONB lyrics round-trip |

기존 tracked unit tests는 Route validation, unknown constraint safe 500, auth helper, DTO/cache/form/error UX를
계속 보호한다. 이 integration suite에서 동일 P1/P2 assertion을 복제하지 않는다.

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

PLAN 단계에서는 PostgreSQL을 실행하거나 DB를 변경하지 않았다. 구현 후 production credential을 사용하지
않고 다음 명령을 실행한다.

Local fresh lifecycle:

```bash
pnpm test:integration:postgres:local
```

CI-equivalent lifecycle against an already healthy ephemeral PostgreSQL 17 service:

```bash
M7_TEST_POSTGRES_ADMIN_URL=<local-test-admin-url-without-production-credentials> \
  pnpm test:integration:postgres
```

Standard gates and final diff check:

```bash
pnpm type-check && pnpm test:harness && pnpm lint && pnpm lint:fsd && \
  pnpm test:unit:run && pnpm format:check && pnpm build && git diff --check
```

Acceptance requires all of the following:

1. fresh checkout와 GitHub Actions가 `.local` 또는 기존 application DB 없이 동일 tracked suite를 실행한다.
2. 고유한 빈 DB에 tracked migration `0000`~`0004`가 처음부터 적용되고 journal 5/hash가 일치한다.
3. 위 P0 table의 모든 scenario가 실제 PostgreSQL 17, real Repository/Service/CASL 경로에서 통과한다.
4. success와 의도적 test failure probe 모두 client를 닫고 active connection/advisory lock 0, temp DB
   catalog 부재를 확인한다. cleanup assertion 실패는 command/CI 실패다.
5. 기존 repository standard gates와 build가 계속 통과한다.
6. exact command, PostgreSQL version, test count, cleanup 결과와 limitation을 이 문서의 VERIFICATION에
   기록하고 독립 review가 APPROVE한 뒤 Status를 `CLOSED`로 바꾼다.

### Risks / Unknowns

- GitHub Actions service의 `POSTGRES_HOST_AUTH_METHOD=trust`는 ephemeral CI container와 runner-local
  port에만 허용한다. 공유 host나 production topology에 재사용하면 안 된다.
- local port 5432가 다른 PostgreSQL에 점유됐거나 Compose credential이 바뀌면 `--local` command가
  명시적으로 실패할 수 있다. 자동으로 다른 URL이나 application DB를 탐색하지 않는다.
- Vitest의 module isolation과 `getDatabase()` global singleton이 client close를 어렵게 만들 수 있다.
  한 test file/worker와 단일 `afterAll`을 유지하고 종료 후 server-side connection count로 검증한다.
- OTP concurrency는 wall-clock sleep만으로 순서를 추정하면 flaky하다. 기존 실제 PostgreSQL advisory-lock
  wait 관찰 barrier를 축소 재사용하고 충분한 bounded timeout을 둔다. timeout을 늘려 race를 숨기지 않는다.
- test process가 SIGKILL 또는 runner VM 종료로 강제 중단되면 local cluster에 임시 DB가 남을 수 있다.
  정상 failure/SIGINT/SIGTERM은 `finally` cleanup하며 CI container는 job 종료 시 폐기된다. 구현 review는
  prefix가 일치하는 정확한 DB 외에는 force cleanup하지 않는지 확인한다.
- integration suite의 argon2와 concurrency가 기존 15분 CI timeout을 넘기는지는 아직 측정하지 않았다.
  먼저 최소 scenario의 실제 시간을 측정하고, 느리면 scenario 중복을 줄인다. test semantics를 mock으로
  바꾸거나 무근거로 timeout만 확대하지 않는다.
- final verification report는 이 PLAN 기준 commit에서 아직 PR #69의 별도 branch evidence다. 병합 전에
  report 내용이나 `migration_develop` migration set이 바뀌면 implementation 시작 전 baseline을 다시
  대조한다.
- 구현 중 실제 production behavior regression, migration drift, PostgreSQL 17 이외 requirement 또는
  CI 정책상 trust auth 금지가 확인되면 test-only 변경에 application/architecture 수정을 섞지 않고
  중단해 별도 결정을 요청한다.

현재 evidence에서는 architecture/domain policy 변경, schema migration, production 접근 또는 P2 test
redesign이 필요하지 않아 즉시 해결해야 할 escalation은 없다.

### Implementation Prompt

```text
Implement exactly M7-DATA-008 from
docs/migration/m7-foundation-fixes/DATA-008.md. Do not implement another finding.

Goal:
- Replace ignored/manual PostgreSQL P0 evidence with one small tracked integration suite and
  a deterministic PostgreSQL 17 lifecycle runnable from a fresh checkout and CI.

Allowed tracked scope:
- tests/integration/m7-foundation.postgres.test.ts
- vitest.postgres.config.ts
- scripts/run-postgres-integration-tests.ts
- package.json
- .github/workflows/verify.yml
- docs/migration/m7-foundation-fixes/DATA-008.md for implementation/verification evidence

Required test coverage:
- signup success including PENDING -> VERIFIED -> CONSUMED, identity rows, and replay denial
- real nickname and credential-email late failures with transaction rollback and known 409 mapping
- first-request and reissue OTP concurrency with one success, one OTP_COOLDOWN, one mail,
  winner-only counters, and exact challenge states
- real Album create/update and Song slug known unique conflict mapping
- direct guest/USER/REVIEWER denial for all privileged Album/Song Service entries with real CASL
- PostgreSQL 17 plus exact 0000~0004 journal/hash, nullable/global uniqueness, FK failure and
  transaction rollback, cascade, Song ordering, visibility, and JSONB lyrics public reads

Lifecycle:
- Add a DATA-008-specific runner, not a generic DB test framework.
- Accept only an explicit local test admin URL, or use --local after starting compose.dev.yml postgres.
- Create a validated unique oioi_m7_test_* database, pass its URL only through child env, invoke
  the existing pnpm db:migrate guard/migrator, run vitest.postgres.config.ts, close clients, assert
  zero connections/advisory locks, drop the database, and verify catalog absence.
- Always attempt cleanup. Cleanup failure must make the command fail even if tests passed. Never
  log URLs/passwords or use production credentials/application databases.
- Add a postgres:17 GitHub Actions service and run pnpm test:integration:postgres as a required
  step without .local, external mail, R2, Sentry, or production secrets.

Preserve:
- Current Service-owned transaction and Repository(DbExecutor) architecture.
- Existing application behavior, schema, migrations, unit/coverage config, and P1/P2 ownership.
- Mock only external mail delivery; do not mock DB, Repository, Service, transaction, CASL, or
  persistence results claimed as integration evidence.

Verification:
- Run pnpm test:integration:postgres:local.
- Run pnpm type-check, pnpm test:harness, pnpm lint, pnpm lint:fsd,
  pnpm test:unit:run, pnpm format:check, pnpm build, and git diff --check.
- Confirm the GitHub Actions PostgreSQL step from a fresh checkout.
- Record exact version, migrations, test counts, cleanup evidence, commands, deviations, and
  limitations in DATA-008.md. Prepare a diff review packet; do not self-approve or mark CLOSED.

Stop and escalate if a required scenario reveals a real application regression; migrations
0000~0004 do not apply cleanly; CI cannot provide isolated PostgreSQL 17 without production
credentials; cleanup cannot be made deterministic; an application/schema/architecture file is
needed; or the implementation would require browser E2E, P2 coverage cleanup, a generic test
framework, or tracked .local files.
```

## IMPLEMENTATION

pending

## VERIFICATION

pending

## REVIEW

pending
