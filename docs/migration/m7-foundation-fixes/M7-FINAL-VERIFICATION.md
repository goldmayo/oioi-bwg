# M7 Final Verification

## Status

PASS

- 검증 일시: 2026-09-07 02:27 KST
- 실제 실행 모델: Codex (GPT-5)
- reasoning effort: 실행 환경에 노출되지 않아 추정하지 않음
- 결론: DATA-001~009가 모두 `CLOSED`이고, 현재 통합 HEAD에서 architecture/security/data
  consistency regression이 발견되지 않았다. PostgreSQL 17 actual integration과 repository gate도 모두
  통과했으므로 M7 foundation을 형식적으로 닫을 수 있다.

## Baseline

검증 시작 시점의 기준은 다음과 같다.

| 항목 | 결과 |
| --- | --- |
| 시작 branch | `migration_develop` |
| integrated HEAD | `c0f7754956a4b10a0be35c756baa4e0f140e2741` |
| `origin/migration_develop` HEAD | `c0f7754956a4b10a0be35c756baa4e0f140e2741` |
| local/origin 일치 | PASS — `git fetch origin migration_develop --prune` 후 동일 |
| working tree | clean |
| PostgreSQL | `17.11 (Debian 17.11-1.pgdg13+2)`, Docker Compose localhost |
| production credential/DB | 사용하지 않음 |
| 기존 local application DB write | 없음. catalog와 duplicate 집계만 `BEGIN READ ONLY`로 조회 |
| 검증용 DB | tracked lifecycle 1개와 finding별 보조 DB 5개; 검증 후 모두 drop |

Canonical 보고서는 위 integrated HEAD에서 분기한 `migration_m7-final-verification-v2`에서 작성했다.
보고서 추가 전까지 tracked tree는 `migration_develop` merge HEAD와 동일했다.

## Finding Status

| Finding | Canonical status | 최종 판정 | 현재 HEAD 재검증 근거 |
| --- | --- | --- | --- |
| DATA-001 | `CLOSED` | accepted | signup 성공/replay/두 late rollback을 actual PostgreSQL에서 재검증 |
| DATA-002 | `CLOSED` | accepted | guest/USER/REVIEWER denial, validation-before-storage와 safe Action contract 재검증 |
| DATA-003 | `CLOSED` | accepted | known Album/signup/Song 23505와 unknown actual constraint의 500 경로 재검증 |
| DATA-004 | `CLOSED` | accepted | actual Drizzle credential 오류와 synthetic marker의 logger/Sentry/public body 비노출 재검증 |
| DATA-005 | `CLOSED` | accepted | nullable global unique, immutability, concurrency와 public visibility를 actual PostgreSQL에서 재검증 |
| DATA-006 | `CLOSED` | accepted | 정확한 TanStack Query invalidation과 editor draft 보존 재검증 |
| DATA-007 | `CLOSED` | accepted | Service/Route/parser/hydration/cache의 explicit list DTO 일치 재검증 |
| DATA-008 | `CLOSED` | accepted | tracked 9-test PostgreSQL lifecycle, required CI step와 merge HEAD CI PASS 확인 |
| DATA-009 | `CLOSED` | accepted | 최초/재발급 동시성, email/IP limit, rollback/mail/lock을 actual PostgreSQL에서 재검증 |

미완료, verification-only, policy-unresolved 또는 bookkeeping-only 상태의 finding은 없다. Closed finding을
다시 여는 새로운 evidence도 발견되지 않았다.

## Integrated Verification

현재 integrated HEAD에서 다음 실제 경로를 검증했다.

- signup: `requestOtp -> verifyOtp -> completeSignup` 성공, challenge `CONSUMED`, ACTIVE Account와
  Profile/PasswordCredential 생성, credential email verification timestamp 확인.
- replay: 소비된 challenge 재사용은 `OTP_NOT_VERIFIED`; 추가 identity row 없음.
- rollback: nickname/credential email 충돌은 각각 공개 409 domain error로 변환되고 challenge는
  `VERIFIED`, `consumed_at`은 null, 중간 identity row는 rollback.
- OTP: 같은 email의 최초/재발급 동시 요청은 success 1 / `OTP_COOLDOWN` 1 / mail 1. 재발급은 이전
  challenge `INVALIDATED`, 신규 현재 challenge `PENDING` 1개.
- rate limit: email 5회 후 6번째와 IP 20회 후 21번째가 `OTP_RATE_LIMITED`; loser/거부 transaction은
  counter를 남기지 않음.
- transaction failure: 잘못된 `inet` insert는 challenge/counter rollback 및 mail 0회. 후속 정상 요청
  성공으로 transaction advisory lock 해제 확인.
- persistence: migration 0000~0004 hash/journal, Song nullable global unique, FK rollback, Album->Song
  cascade, public visibility, Song order와 JSONB lyrics round-trip 확인.
- authorization: guest/USER/REVIEWER는 Album/Song privileged Service 10개에서 직접 거부됨.
- upload: guest/USER/REVIEWER는 validation/storage 전에 거부되고 storage call 0. ADMIN만 validation 후
  허용됨.
- contract/cache: explicit list DTO와 Query cache/refetch shape가 일치하고 정확한 list key만
  invalidate하며 editor draft는 유지됨.

## PostgreSQL Verification

### Durable tracked lifecycle

`pnpm test:integration:postgres:local`은 현재 repository의 tracked lifecycle을 그대로 실행했다.

- Docker Compose PostgreSQL 17 health 확인.
- `oioi_m7_test_<unique suffix>` 임시 DB 생성.
- `scripts/assert-local-database.ts` local guard 통과.
- Drizzle migration 0000~0004를 빈 DB에 적용.
- `tests/integration/m7-foundation.postgres.test.ts` 1 file / 9 tests PASS.
- 종료 시 connection 0, advisory lock 0 확인 후 DB drop.
- maintenance catalog에서 최종 임시 DB 0개와 cluster advisory lock 0개 확인.

같은 integrated HEAD의 GitHub Actions push run `34048259905`도 PostgreSQL 17 service에서 같은 tracked
suite 9개, migration, guard와 cleanup을 모두 통과했다. CI URL/로그에는 database password 또는 production
credential이 없다.

### Supplementary final verification

최종 요청의 세부 finding 항목은 기존 `.local` 진단 suite를 보조 evidence로만 재실행했다. 이 파일들은
durable coverage로 계산하지 않으며, durable M7 P0 gate는 위 tracked suite와 CI다. 각 보조 suite에는
별도 localhost 임시 DB를 만들고 guard와 migration 0000~0004를 적용했다.

| Suite | 결과 |
| --- | --- |
| tracked M7 foundation | 1 file / 9 tests PASS |
| DATA-001 | 1 file / 3 tests PASS |
| DATA-003 | 1 file / 5 tests PASS |
| DATA-004 | 1 file / 1 test PASS |
| DATA-005 | 1 file / 6 tests PASS |
| DATA-009 | 1 file / 4 tests PASS |
| 합계 | 6 files / 28 executed tests PASS |

DATA-003의 unknown constraint 검증은 해당 임시 DB에만 `Album.name` UNIQUE를 추가했다. 실제
`23505 / Album_name_verification_key`는 known conflict로 오분류되지 않고 safe generic 500을 반환했다.
Application schema/migration은 변경하지 않았고 임시 DB와 함께 제거했다.

보조 DB 5개도 각각 종료 시 `connections=0`, `locks=0`, `remaining=0`을 확인했다. 모든 DB 검증 후
maintenance catalog의 M7 대상 임시 DB는 0개이고 cluster advisory lock도 0개다.

## Architecture Boundary

현재 integrated source는 다음 경계를 유지한다.

```text
RSC -> Service -> Repository(DbExecutor) -> Drizzle
Client -> TanStack Query -> ky -> Route Handler -> Service -> Repository
Auth.js -> RequestContext -> requireUser / CASL -> Service security boundary
Zod input/output -> Route Handler -> jsonResponse / toErrorResponse
```

Repository-wide import/usage scan 결과:

- DB/schema/repository import는 `src/server`의 DB/repository/service/auth 경계와 tests에 한정된다.
- RSC와 Route Handler의 direct DB/repository 접근은 발견되지 않았다.
- `$inferSelect`/`$inferInsert`는 server DB/schema/repository 안에만 있고 client/shared contract로 새지 않는다.
- Route Handler는 Service와 Zod/http mapper를 사용하고 direct repository를 호출하지 않는다.
- `use server` 파일은 upload delivery adapter, Auth.js sign-in/out adapter, feature flag helper다. Privileged DB
  mutation을 직접 수행하는 Server Action은 없다.
- Upload Action은 safe synthetic error만 client-oriented logger에 전달하고 실제 authorization/storage는
  Service boundary 뒤에 있다.
- generic success envelope는 HTTP API convention에 없다. 제한적 upload Server Action의 local result는
  승인된 form adapter contract이며 HTTP convention이 아니다.

다음 runtime regression도 발견되지 않았다.

- Supabase Auth runtime/client/server 사용
- Vinext runtime, Cloudflare Worker entry 또는 Hyperdrive binding
- Query-owned state의 `window.location.reload`, `location.reload`, `router.refresh`
- `use cache`, `unstable_cache`, `updateTag`, `revalidateTag`, `revalidatePath` 기반 이중 consistency ownership
- raw Drizzle row type의 client/shared external contract 유출

`pnpm-lock.yaml`의 Cloudflare 관련 optional peer/transitive dependency와 승인된 R2 provider는 runtime
regression으로 분류하지 않는다.

## Security

- Album/Song privileged Service는 `requireUser`와 CASL `manage/all`을 최종 경계로 사용한다.
- Actual PostgreSQL suite에서 guest/USER/REVIEWER가 10개 privileged Service entry를 모두 직접 거부했다.
- Upload 흐름은 `RequestContext -> uploadAlbumImage Service -> requireUser/CASL -> Zod validation ->
  server/storage` 순서다.
- Invalid FormData/string, unsupported MIME, oversized file은 storage 전에 거부된다.
- 5 MiB exact boundary와 AVIF/JPEG/PNG/WebP allowlist가 focused tests로 고정돼 있다.
- Storage raw error는 Action 응답에 노출되지 않는다. 실제 R2 network write/credential은 사용하지 않았다.
- UI/layout visibility는 authorization evidence로 사용하지 않았다.

DATA-004 actual Drizzle failure와 focused observability tests에서 SQL/params, email, password/password hash,
OTP/OTP hash, token, cookie, Authorization header, private IP와 raw nested cause marker가 logger line, console
payload, Sentry capture/event, instrumentation metadata와 HTTP body에 남지 않음을 확인했다. Logger는 object가
아닌 단일 serialized JSON string을 출력하고 CR/LF가 없는 one-line JSON을 유지한다. Event/source, safe
error type/code, 안전한 stack filename/function/line/column과 trace identifier는 보존된다. Unexpected failure의
HTTP contract는 generic 500을 유지한다.

## Contracts

- Known `23505`만 Service allowlist constraint에 따라 domain `AppError`로 변환되고 공개 409를 반환한다.
- Album slug create/update, signup email/nickname, Song slug duplicate를 actual PostgreSQL에서 확인했다.
- Test-only unknown Album constraint는 expected conflict로 바뀌지 않고 safe generic 500을 반환했다.
- 실패한 signup/slug mutation은 원래 row/challenge/identity 상태를 보존한다.
- Album/Song 관리자 목록은 각각 `{ items, nextCursor: null }`의 domain-specific DTO를 사용한다.
- Service output, Route output schema, browser parser, RSC `setQueryData`, Query cache/refetch consumer가 같은
  DTO를 사용하며 bare-array 또는 generic `{ success, data }` drift가 없다.
- 전체 조회와 client pagination/filter를 유지하고 server pagination을 추가하지 않았다.

DATA-005 승인 정책도 현재 code/schema/migration/DB test에서 유지된다.

- `Song.id`는 stable internal identity다.
- `Song.slug`는 nullable이며 non-null 값만 global unique다. 여러 null은 허용된다.
- null에서 최초 지정은 허용되고 기존 non-null slug는 Service boundary에서 immutable하다.
- title 변경과 slug를 유지한 album move는 허용된다.
- same/cross album 및 hidden Song의 같은 slug는 409로 거부된다.
- concurrent create/first assignment에는 winner 하나만 남고 failure는 데이터를 보존한다.
- public `/songs/{slug}`는 Song과 Album visibility를 모두 적용한다.
- suffix 생성, 새 UUID/public id 또는 slug 기반 future domain identity를 도입하지 않았다.

## Cache

Production `QueryClient`를 사용하는 focused 3 files / 8 scenarios가 모두 통과했다.

- Lyrics save 성공은 `songQueryKeys.adminList()`만 invalidate한다.
- Album rename/delete는 Album list와 route-composed Song admin list를 invalidate한다.
- Album create와 동일-name update는 Song list를 불필요하게 invalidate하지 않는다.
- Mutation failure는 secondary data-list invalidation을 실행하지 않는다.
- Unrelated query key와 editor local draft는 보존된다.
- RSC-only public view를 Query ownership으로 전환하지 않았다.
- Next Data Cache와 TanStack Query의 동일 mutable server state 이중 ownership은 발견되지 않았다.

## Testing

### P0

현재 tracked repository/CI coverage는 다음 closure-critical 실제 PostgreSQL 경로를 보호한다.

- signup success, replay, nickname/email late rollback
- OTP verification/consumption state와 최초/재발급 concurrency
- known Album/Song/signup DB conflict mapping
- guest/USER/REVIEWER privileged Album/Song Service denial
- migration journal/hash와 0000~0004 scratch migration
- critical FK rollback, unique constraint, order, JSONB lyrics, cascade와 public visibility/read
- critical Album/Song Service mutation과 constraint/data preservation

Email/IP rate limit, failed transaction/mail/lock, unknown constraint와 DATA-005 상세 concurrency는 이번 final
verification의 supplementary actual PostgreSQL suites로도 통과했다. DATA-008의 tracked suite와 CI는 fresh
checkout에서 `.local` 없이 실행된다.

### P1

- Route validation/error mapping: tracked Route 및 `api-response` tests.
- Cache invalidation: production QueryClient 기반 3 files / 8 focused scenarios.
- Form/field errors: Song duplicate/immutable와 Album mutation UI tests.
- DTO consistency: Service/Route/entity parser/RSC seed/Query consumer tests.
- Focused security/contract/cache run: 14 files / 62 tests PASS.
- Full unit gate: 46 files / 182 tests PASS.

### P2

- Browser E2E: Playwright package는 있으나 config/spec/fixture lifecycle은 아직 없다.
- Coverage: Vitest V8 설정/script는 있으나 include가 일부 legacy shared hooks/utils와 feature `use*`로 좁다.
- Load continuity: `tests/k6/{load,stress,spike}.js`가 존재하나 이번 검증에서는 staging을 호출하지 않았다.

P2는 승인된 DATA-008 closure 범위와 M7 P0 closure blocker가 아니다. 이번 verification에서 새 framework,
browser suite 또는 coverage redesign을 추가하지 않았다.

## Runtime / Deployment

| 항목 | 분류 | 현재 repository evidence |
| --- | --- | --- |
| Next standalone | complete | `next.config.ts`의 `output: "standalone"`, local `pnpm build` PASS |
| Docker development | complete | `Dockerfile.dev`, `compose.dev.yml`, PostgreSQL healthcheck |
| Docker production | out-of-scope-for-M7 | production Dockerfile/Compose artifact 없음; M9 대상 |
| Caddy | out-of-scope-for-M7 | artifact 없음; active runbook의 M9 대상 |
| CI verify | complete | install, `pnpm verify`, PostgreSQL 17 integration, format check |
| CI build | partial | workflow에 build step 없음; local build는 PASS |
| Cloudflare runtime remnants | complete | application Worker/Hyperdrive runtime entry/binding 없음 |
| R2 storage | partial | server storage adapter/mock tests 존재; real credential/network/bucket policy 미검증 |
| image optimization | partial | remote pattern은 있으나 `images.unoptimized: true`; M8 후속 |
| production deployment completeness | out-of-scope-for-M7 | M9 Docker/Caddy/health/backup/rollback/HTTPS 작업 |

후속 phase로 명시된 배포 항목은 M7 closure blocker로 사용하지 않는다.

## Remaining Unknowns

| ID | 관찰값/unknown | 분류 |
| --- | --- | --- |
| U1 | local application DB는 migration journal 2개이며 tracked journal은 5개 | C. Operations / Deployment |
| U2 | local application DB의 nullable `profile.bio` 기원은 repository에서 확인되지 않음 | C. Operations / Deployment |
| U3 | local application DB에는 `Song_slug_key`가 없고 현재 non-null duplicate group은 0 | C. Operations / Deployment |
| U4 | production schema/journal/Song.slug duplicate/table size/lock window | F. Environment Unknown |
| U5 | production RLS/storage bucket/R2 credential 동작 | F. Environment Unknown |
| U6 | 실제 Sentry Relay/source-map/grouping/retention/access control | F. Environment Unknown |
| U7 | repository 밖 private admin API consumer | F. Environment Unknown |

U1~U3은 기존 local application DB에 migration/fixture를 적용하지 않고 read-only로 관찰했다. U4~U7을
foundation source correctness의 증거로 추정하지 않는다.

## Remaining Debt Classification

### A. M7 BLOCKER

- 없음.

### B. FOLLOW-UP MIGRATION DEBT

- P2 browser E2E fixture/spec lifecycle.
- Coverage scope/gate 정비.
- CI workflow의 build gate 추가 검토. 현재 local build는 PASS지만 CI에는 build step이 없다.
- GitHub Actions v4 action의 Node.js 20 deprecation annotation 해소를 위한 compatible action 갱신.
- 비어 있는 legacy `drizzle/relations.ts` artifact의 근거 기반 정리 여부.

### C. OPERATIONS / DEPLOYMENT

- U1~U3: local application DB 0002~0004 적용 또는 재생성/복원 절차와 drift reconciliation.
- Production migration preflight/deployment window와 backup/restore/rollback runbook 실행.
- Production Docker/Caddy/health/HTTPS artifact 및 운영 검증.
- R2 network/credential/bucket policy와 image optimization/runtime asset cleanup.

### D. PRODUCT DECISION

- Song slug 삭제 후 재사용, 영구 예약 또는 redirect/history 정책.
- Upload magic-byte 검사, orphan object cleanup, audit/rate-limit 요구.

### E. FUTURE DOMAIN

- CheerGuide/Revision/Contribution/Discussion/Cue/PerformanceSchedule 등 신규 domain schema와 feature.

### F. ENVIRONMENT UNKNOWN

- U4~U7: production DB/data/security policy, 실제 Sentry 처리와 repository 외 private consumer.

## Repository Gates

Integrated HEAD에서 다음 명령을 실제 연속 실행했다.

```text
pnpm type-check && pnpm test:harness && pnpm lint && pnpm lint:fsd && pnpm test:unit:run && pnpm format:check && pnpm build && git diff --check
```

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
| `pnpm test:integration:postgres:local` | PASS — PostgreSQL 17, 1 file / 9 tests, cleanup PASS |

추가 actual PostgreSQL 명령은 각 격리 DB에서 아래 형태로 실행했다. URL password는 기록하지 않는다.

```text
DATABASE_URL=<explicit 127.0.0.1 temporary database URL> node --import tsx scripts/assert-local-database.ts
M7_DATA_001_DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-001-verification.config.ts --reporter=verbose
M7_DATA_003_DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-003-verification.config.ts --reporter=verbose
M7_DATA_004_DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-004-verification.config.ts --reporter=verbose
DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-005-verification.config.ts --reporter=verbose
M7_DATA_009_DATABASE_URL=<temporary URL> node node_modules/vitest/vitest.mjs run --config .local/m7-data-009-verification.config.ts --reporter=verbose
```

Merge HEAD의 GitHub Actions `Verify` push run `34048259905`도 `pnpm verify`, PostgreSQL integration과
format check를 통과했다.

## Final Verdict

PASS

모든 M7 finding은 accepted final state인 `CLOSED`다. 현재 integrated HEAD에서 unresolved
P0/security/data consistency blocker, architecture regression 또는 test lifecycle 누락은 발견되지 않았다.
Actual PostgreSQL verification, durable CI integration과 repository gates가 모두 통과했고 remaining debt와
environment unknown은 M7 blocker가 아닌 후속 범주로 명시됐다.

## Next Phase

M7 foundation verified and may be closed.

1. 이 보고서와 M7 completion evidence를 freeze/update한다.
2. Repository workflow에 따라 verification checkpoint를 `migration_develop`에 병합한다.
3. Product Delivery Roadmap을 작성한다.
4. 첫 product vertical slice를 선택한다.
5. 해당 slice의 첫 Feature Implementation Spec을 작성하고 승인한다.
6. 승인된 slice에서만 신규 product development를 시작한다.

이번 final verification에서는 Product Delivery Roadmap 작성이나 feature 구현을 시작하지 않았다.
