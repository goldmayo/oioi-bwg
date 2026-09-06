# M7 Final Verification

## Status

FAIL

- 검증 일시: 2026-09-07 01:25 KST
- 실제 실행 모델: Codex (GPT-5)
- reasoning effort: 실행 환경에 노출되지 않아 추정하지 않음
- 결론: 현재 통합 코드의 기능·보안·데이터 정합성 회귀는 발견되지 않았지만,
  `M7-DATA-008`의 지속 가능한 실제 PostgreSQL 회귀 coverage와 canonical 종료 기록이 없어 M7을
  형식적으로 닫을 수 없다.

## Baseline

검증 시작 시점의 기준은 다음과 같다.

| 항목 | 결과 |
| --- | --- |
| 현재 branch | `migration_develop` |
| current HEAD | `2e20edc1e163d91193b3cd92f0339b559c5a4cf1` |
| `origin/migration_develop` HEAD | `2e20edc1e163d91193b3cd92f0339b559c5a4cf1` |
| local/origin 일치 | PASS — `git fetch origin migration_develop --prune` 후 동일 |
| working tree | clean |
| PostgreSQL | `17.11 (Debian 17.11-1.pgdg13+2)`, Docker Compose localhost |
| production credential/DB | 사용하지 않음 |
| 기존 local application DB write | 없음. catalog와 duplicate 집계만 `BEGIN READ ONLY`로 조회 |
| 검증용 DB | finding별 격리 임시 DB 6개; 검증 후 전부 drop |

Canonical 보고서 작성은 검증한 HEAD에서 분기한 `migration_m7-final-verification`에서 수행했다.
보고서 추가 전까지 tracked tree는 위 통합 HEAD와 동일했다.

## Finding Status

| Finding | Canonical status | 최종 판정 | 근거 |
| --- | --- | --- | --- |
| DATA-001 | `CLOSED` | accepted | 정상 signup, replay 거부, nickname/email 후반 실패 rollback을 현재 HEAD와 실제 PostgreSQL에서 재검증 |
| DATA-002 | `CLOSED` | accepted | ADMIN-only Service 경계, validation-before-storage, 안전한 Action/storage contract를 unit suite에서 재검증 |
| DATA-003 | `CLOSED` | accepted | Album create/update, signup email/nickname known 23505 → 409와 unknown actual constraint → generic 500을 실제 PostgreSQL에서 재검증 |
| DATA-004 | `CLOSED` | accepted | 실제 Drizzle credential 오류와 synthetic marker의 logger/Sentry/public body 비노출을 재검증 |
| DATA-005 | `CLOSED` | accepted | 승인된 global nullable unique/immutability 정책, migration, concurrency와 public read를 실제 PostgreSQL에서 재검증 |
| DATA-006 | `CLOSED` | accepted | 정확한 Query key invalidation과 editor draft 보존을 현재 tracked tests에서 재검증 |
| DATA-007 | `CLOSED` | accepted | Route/Service/parser/hydration/cache의 명시적 list DTO 일치를 현재 tracked tests와 source에서 재검증 |
| DATA-008 | canonical finding 문서 없음 | **implementation incomplete** | `P0-FOUNDATION-CHECKPOINT.md`는 `PASS`지만 실제 PostgreSQL fixture의 영구 CI lifecycle을 DATA-008에 남겼다. 현재 DB suites는 `.local` ignore 파일이며 CI가 실행하지 않는다. PLAN→IMPLEMENT→REVIEW/CLOSED evidence도 없다. |
| DATA-009 | `CLOSED` | accepted | 최초/재발급 동시성, cooldown loser counter, email/IP limit, rollback/mail/lock을 현재 HEAD와 실제 PostgreSQL에서 재검증 |

DATA-008은 문서 상태 bookkeeping만의 문제가 아니다. M7이 고친 signup transaction, unique conflict,
OTP concurrency가 이후 PR에서 깨져도 현재 `.github/workflows/verify.yml`은 이를 실제 PostgreSQL에서
검출하지 못한다. 따라서 finding registry의 completion rule을 충족하지 않는다.

## Integrated Verification

현재 HEAD에서 다음 실제 경로를 검증했다.

- signup: `requestOtp → verifyOtp → completeSignup` 성공, challenge `CONSUMED`, ACTIVE Account와
  Profile/PasswordCredential 생성, credential email verified timestamp 확인.
- replay: 소비된 challenge 재사용은 `OTP_NOT_VERIFIED`, 추가 identity row 없음.
- rollback: nickname 및 credential email 충돌 모두 challenge가 `VERIFIED`로 복원되고
  `consumed_at`과 중간 identity row가 남지 않음.
- OTP: 동일 email 최초/재발급 동시 요청은 success 1 / `OTP_COOLDOWN` 1 / mail 1,
  winner counter만 남고 현재 PENDING challenge는 1개.
- rate limit: email 5회 후 6번째, IP 20회 후 21번째가 `OTP_RATE_LIMITED`.
- transaction failure: 잘못된 `inet` insert는 challenge/counter를 rollback하고 mail 0회;
  후속 정상 요청으로 advisory lock 해제 확인.
- persistence: migration hash/journal, 7개 table/52개 column, Album→Song cascade,
  public visibility, Song order와 JSONB lyrics round-trip, FK failure rollback 확인.
- authorization: guest/USER/REVIEWER가 Album/Song privileged Service 10개에서 직접 거부됨.

검증 과정의 진단 실패도 숨기지 않는다.

1. 최초 임시 DB 이름 `m7_final_*`은 local suite의 이름 안전 가드가 거부했다. 모든 suite가 import 또는
   assertion 단계에서 끝나 migration/fixture가 적용되지 않았다. 빈 DB를 drop하고 허용 prefix로 다시
   생성했다.
2. DATA-003의 local suite는 DATA-005 전 migration count `4`를 고정해 현재 정상 journal `5`를 실패로
   처리했다. 실제 conflict/rollback 3개는 같은 실행에서 통과했다. 비추적 `.local` assertion을 `5`로
   갱신하고 새 DB에서 전체 suite를 재실행해 5/5 통과했다.
3. 요청된 unknown actual constraint 검증이 없어서 임시 DB에만 `Album.name` test UNIQUE를 추가했다.
   실제 `23505 / Album_name_verification_key`는 known conflict로 오분류되지 않았고 generic 500을 반환했다.
   application schema와 migration은 변경하지 않았다.

## PostgreSQL Verification

모든 DB suite는 명시적인 `127.0.0.1` 임시 URL로 `scripts/assert-local-database.ts` guard를 통과했고,
tracked migration 0000~0004 다섯 개를 실제 Drizzle migrator로 적용했다.

| Suite | 최종 결과 |
| --- | --- |
| DATA-001 | 1 file / 3 tests PASS |
| DATA-003 | 1 file / 5 tests PASS |
| DATA-004 | 1 file / 1 test PASS |
| DATA-005 | 1 file / 6 tests PASS |
| DATA-009 | 1 file / 4 tests PASS |
| core persistence/authz/public read | 1 file / 4 selected tests PASS |
| 합계 | 6 files / 23 executed tests PASS |

핵심 실행 명령은 다음과 같다. URL의 password 부분은 보고서에 기록하지 않는다.

```text
docker compose -f compose.dev.yml up -d --wait postgres
DATABASE_URL=<explicit 127.0.0.1 temporary database URL> node --import tsx scripts/assert-local-database.ts
M7_DATA_001_DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-001-verification.config.ts --reporter=verbose
M7_DATA_003_DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-003-verification.config.ts --reporter=verbose
M7_DATA_004_DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-004-verification.config.ts --reporter=verbose
DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-005-verification.config.ts --reporter=verbose
M7_DATA_009_DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-009-verification.config.ts --reporter=verbose
node node_modules/vitest/vitest.mjs run --config .local/m7-verification.config.ts --reporter=verbose -t 'fresh migrations|real public reads|repository tx executor|guest / USER / REVIEWER'
```

종료 시 여섯 DB 모두 active connection 0, cluster advisory lock 0을 확인한 뒤 명시적으로 drop했다.
최종 catalog에서 대상 임시 DB 0개와 advisory lock 0을 재확인했다.

## Architecture Boundary

현재 integrated source는 다음 경계를 유지한다.

```text
RSC -> Service -> Repository(DbExecutor) -> Drizzle
Client -> TanStack Query -> ky -> Route Handler -> Service -> Repository
Auth.js -> RequestContext -> requireUser / CASL -> Service security boundary
Zod input/output -> Route Handler -> jsonResponse / toErrorResponse
```

Repository/schema import는 `src/server`의 DB/repository/service/auth 경계와 test에 한정된다. RSC와 Route
Handler의 직접 DB/repository 접근, Client의 persistence row import, Route Handler의 direct repository
호출은 발견되지 않았다. Service가 transaction을 소유하고 Repository는 전달된 `DbExecutor`를 사용한다.

Repository-wide scan에서 다음 runtime regression은 발견되지 않았다.

- Supabase Auth runtime/client/server 사용
- Vinext runtime, Cloudflare Worker entry 또는 Hyperdrive binding
- Query-owned state의 `window.location.reload`, `location.reload`, `router.refresh`
- `use cache`, `unstable_cache`, `updateTag`, `revalidatePath` 기반 이중 consistency ownership
- privileged Server Action의 DB 직접 mutation
- generic success envelope를 HTTP API convention으로 사용
- raw Drizzle row type의 client/shared external contract 유출

`pnpm-lock.yaml`의 `@cloudflare/workers-types`와 `pg-cloudflare`는 Drizzle dependency graph의 optional
peer/transitive 항목이며 application runtime import나 binding이 아니다. R2는 승인된 storage provider로
의도적으로 유지한다.

## Security

- Album/Song privileged Service는 `requireUser`와 CASL `manage/all`을 최종 경계로 사용한다.
- upload는 `RequestContext → uploadAlbumImage Service → requireUser/CASL → Zod file validation →
  server/storage` 순서다.
- guest/USER/REVIEWER는 valid/invalid input 모두 storage call 0; ADMIN만 validation 후 허용된다.
- 5 MiB exact boundary와 AVIF/JPEG/PNG/WebP allowlist가 test로 고정돼 있다.
- 실제 R2 network write와 production credential은 사용하지 않았다.
- UI/layout 가시성은 authorization evidence로 사용하지 않았다.

## Contracts

- known `23505`만 service allowlist constraint에 따라 domain `AppError`로 변환되고 공개 409를 반환한다.
- Album slug create/update, signup email/nickname, Song slug duplicate를 실제 PostgreSQL에서 확인했다.
- 검증 전용 unknown Album constraint는 예상 conflict로 바뀌지 않고 safe generic 500을 반환했다.
- Album/Song 관리자 목록은 모두 `{ items, nextCursor: null }`의 domain-specific DTO를 사용한다.
- Service output, Route output schema, client parser, RSC `setQueryData`, Query cache/refetch consumer가 같은
  DTO를 사용하며 bare-array 또는 generic `{ success, data }` drift가 없다.
- 전체 조회와 client pagination/filter를 유지하며 server pagination을 추가하지 않았다.

## Cache

- lyrics save 성공은 `songQueryKeys.adminList()`만 invalidate한다.
- Album rename/delete는 Album list와 route-composed Song admin list를 invalidate한다.
- Album create/동일-name update와 unrelated detail key는 불필요하게 invalidate하지 않는다.
- mutation failure는 secondary invalidation을 실행하지 않는다.
- editor local draft와 RSC-only public view ownership은 유지된다.
- Next Data Cache와 TanStack Query의 동일 mutable state 이중 ownership은 발견되지 않았다.

## Testing

### P0

현재 HEAD의 수동 final verification에서는 모두 PASS했다.

- signup success/replay/two late rollback: actual PostgreSQL
- OTP verification state와 concurrency/rate-limit/rollback: actual PostgreSQL
- known/unknown DB conflict mapping: actual PostgreSQL + tracked wrapper unit
- privileged Album/Song Service denial: actual Service/CASL + PostgreSQL-backed run
- upload denial: tracked Service/Action tests with real CASL and mocked external storage
- migration/constraint/FK/order/cascade/public visibility/read: actual PostgreSQL
- critical Album/Song create/update/delete: actual Service/PostgreSQL 및 tracked Route/Service tests

그러나 actual PostgreSQL P0 test/config는 모두 `.local` ignore 상태이고 CI PostgreSQL job이 없다. 따라서
현재 snapshot이 맞다는 검증과 이후 변경을 보호하는 repository coverage를 구분해야 한다. 후자가
DATA-008 blocker다.

### P1

- Route validation/error mapping: tracked Route와 `api-response` tests
- cache invalidation consumers: production `QueryClient` 기반 3 files / 8 focused scenarios가 full unit에 포함
- form/field error: Song slug duplicate/immutable 및 Album mutation UI tests
- DTO hydration/refetch consistency: Service/Route/entity API/Query consumer tests
- full unit gate: 46 files / 182 tests PASS

### P2

- Browser E2E: Playwright package만 있고 config/test suite가 없어 미구현.
- Coverage: Vitest V8 설정과 `test:coverage` script는 있으나 include가 일부 과거
  `shared/hooks`/`shared/utils` 및 feature `use*`로 좁아 foundation coverage gate가 아니다.
- Load continuity: `tests/k6/{load,stress,spike}.js`가 존재하지만 이번 검증에서는 staging을 호출하지 않았다.

P2 항목은 현재 M7 P0 closure blocker로 분류하지 않는다. DATA-008 REWORK는 먼저 P0 actual PostgreSQL
coverage를 작은 tracked lifecycle로 착지시키는 데 한정해야 한다.

## Runtime / Deployment

| 항목 | 분류 | 현재 repository evidence |
| --- | --- | --- |
| Next standalone | complete | `next.config.ts`의 `output: "standalone"`, `pnpm build` PASS |
| Docker development | complete | `Dockerfile.dev`, `compose.dev.yml`, PostgreSQL healthcheck |
| Docker production | out-of-scope-for-M7 | production Dockerfile/Compose artifact 없음; M9 대상 |
| Caddy | out-of-scope-for-M7 | artifact 없음; runbook의 M9 대상 |
| CI verify | complete | install + `pnpm verify` + format check workflow 존재 |
| CI build/DB integration | partial | workflow에 build와 PostgreSQL integration job 없음 |
| Cloudflare runtime remnants | complete | application runtime entry/binding 없음; R2와 optional lockfile entries만 존재 |
| R2 storage | partial | server/storage adapter와 mock test 존재; 실제 credential/network/bucket policy 미검증 |
| image optimization | partial | remote pattern은 있으나 `images.unoptimized: true`; M8/runtime 후속 |
| production deployment completeness | out-of-scope-for-M7 | M9 Docker/Caddy/health/backup/rollback/HTTPS 작업 미완료 |

배포 항목은 active runbook이 M8/M9로 명시하므로 그 자체로 M7 FAIL을 만들지 않는다.

## Remaining Unknowns

- 기존 local application DB는 migration journal 2개만 적용됐고 tracked journal은 5개다.
- local application DB에는 repository에 없는 nullable `profile.bio`가 있으며 기원은 확인되지 않았다.
- local application DB에는 `Song_slug_key`가 아직 없지만 read-only 집계의 non-null duplicate group은 0이다.
- production schema/journal, production Song.slug duplicate, table size와 UNIQUE lock window는 확인하지 않았다.
- production RLS/storage bucket policy와 R2 network/credential 동작은 확인하지 않았다.
- 실제 Sentry 조직의 Relay 처리, source-map, grouping, retention/access control은 확인하지 않았다.
- 저장소 밖의 비공개 admin API consumer 존재 여부는 확인할 수 없다.

이 unknown은 foundation source correctness와 production reconciliation/rollout을 구분해 유지한다. 이를
해소하려고 local application DB나 production DB에 migration/fixture를 적용하지 않았다.

## Remaining Debt Classification

### A. M7 BLOCKER

- DATA-008: actual PostgreSQL P0 regression tests가 `.local`에만 있어 repository/CI가 보호하지 못한다.
- DATA-008: canonical PLAN/IMPLEMENT/VERIFICATION/REVIEW와 accepted final status가 없다.

### B. FOLLOW-UP MIGRATION DEBT

- P2 browser E2E suite와 coverage scope 정비.
- 비어 있는 legacy `drizzle/relations.ts` artifact의 근거 기반 정리 여부.

### C. OPERATIONS / DEPLOYMENT

- local application DB의 0002~0004 적용 또는 재생성/복원 절차.
- production migration preflight, Song duplicate 확인, UNIQUE lock/deployment window.
- production Docker/Caddy/health/backup/restore/rollback/HTTPS 및 R2/Sentry 운영 검증.
- image optimization/runtime asset cleanup.

### D. PRODUCT DECISION

- Song slug 삭제 후 재사용, 영구 예약, redirect/history 정책.
- upload magic-byte 검증, orphan object cleanup, audit/rate-limit 요구 여부.

### E. FUTURE DOMAIN

- CheerGuide/Revision/Contribution/Discussion/Cue/PerformanceSchedule 등 신규 domain schema와 feature.

### F. ENVIRONMENT UNKNOWN

- production schema/data/RLS/storage policy의 실제 상태.
- 실제 Sentry 수신/가공 결과와 저장소 외 private API consumer.

## Repository Gates

현재 integrated HEAD에서 실제 실행했다.

| Command | Result |
| --- | --- |
| `pnpm type-check` | PASS |
| `pnpm test:harness` | PASS — 7 tests |
| `pnpm lint` | PASS |
| `pnpm lint:fsd` | PASS — `No problems found` |
| `pnpm test:unit:run` | PASS — 46 files / 182 tests |
| `pnpm format:check` | PASS |
| `pnpm build` | PASS — Next.js 16.3.3, 23/23 static pages |
| `git diff --check` | PASS |

연속 실행 command:

```text
pnpm type-check && pnpm test:harness && pnpm lint && pnpm lint:fsd && pnpm test:unit:run && pnpm format:check && pnpm build && git diff --check
```

## Final Verdict

FAIL

현재 integrated HEAD의 M7 기능 결과에는 재현된 regression이 없지만, `M7-DATA-008`이 completion rule을
충족하지 않는다. 기존 architecture와 policy 안에서 해결 가능한 test-lifecycle 구현 누락이므로
`ESCALATE`가 아니라 `FAIL`이다.

정확한 REWORK 대상:

1. DATA-008 canonical plan을 현재 0000~0004 migration과 P0 risk에 맞춰 확정한다.
2. signup success/late rollback, OTP concurrency, known conflict, privileged Service denial,
   critical constraint/FK/order/public read 중 M7 closure에 필요한 실제 PostgreSQL regression을 작은 tracked
   suite로 둔다.
3. PostgreSQL 17 격리 DB create/migrate/test/cleanup lifecycle을 repository command와 CI에 연결한다.
4. required gates와 actual PostgreSQL run을 통과시킨 뒤 DATA-008 review를 `APPROVE`하고 `CLOSED`로 기록한다.
5. 그 merge HEAD에서 이 final verification을 다시 실행한다.

## Next Phase

M7 close, Product Delivery Roadmap, 첫 Feature Implementation Spec 및 신규 제품 개발로 아직 이동하지 않는다.
DATA-008만 REWORK한 뒤 final verification을 재실행한다. 새 product feature나 architecture redesign은
필요하지 않다.
