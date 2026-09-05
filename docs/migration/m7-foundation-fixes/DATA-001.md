# M7-DATA-001

## Status

CLOSED

## PLAN

### Registry recommendation

- PLAN: Sol High
- IMPLEMENT: Sol High
- 보조 test/fixture: Terra
- REVIEW: Sol High

### Confirmed evidence

- 코드 기준은 `3b5743e`의 `migration_develop`이다.
- `emailVerificationChallenge`의 CHECK는 `status = 'VERIFIED'`와 `verified_at IS NOT NULL`을 iff로 묶는다.
- `consumeVerifiedChallenge()`는 `VERIFIED` 행의 `status`와 `consumed_at`만 갱신하여 기존 non-null `verified_at`을 남긴다.
- `completeSignup()`은 challenge consume과 Account/Profile/PasswordCredential 생성을 하나의 Service transaction에서 실행한다. transaction 소유권과 executor 전달 구조는 현재 architecture와 일치한다.
- 2026-09-05 PostgreSQL 17.11 임시 DB 검증에서 `requestOtp → verifyOtp → completeSignup`이 SQLSTATE `23514`, constraint `email_verification_challenge_verified_at_check`로 실패했다. challenge는 `VERIFIED`로 남고 Account는 생성되지 않았다.
- Domain AUTH-002는 OTP 성공 시 즉시 소모를 요구하고, AUTH-T001은 OTP 성공 후 ACTIVE Account와 verified Credential 생성을 요구한다. 소비 후 challenge가 원래 검증 시각을 계속 보존해야 한다는 domain invariant는 확인되지 않았다.

### Root cause

현재 consume 결과는 다음 조합이다.

```text
status = CONSUMED
verified_at = non-null
consumed_at = non-null
```

이때 verified-at CHECK의 좌변은 false, 우변은 true이므로 PostgreSQL이 UPDATE를 거부한다. Account/Profile/PasswordCredential insert보다 먼저 실패하므로 정상 회원가입과 회원가입 후반 실패 rollback을 검증할 수 없다.

### Invariants to preserve

- 상태 전이는 `PENDING → VERIFIED → CONSUMED` 순서를 지킨다.
- `VERIFIED` challenge만 조건부 단일 UPDATE로 한 번 소비할 수 있다.
- 재소비는 row를 반환하지 않고 Service에서 `OTP_NOT_VERIFIED`로 처리한다.
- 현재 schema 계약에 따라 `VERIFIED`일 때만 `verified_at`이 존재하고 `CONSUMED`일 때만 `consumed_at`이 존재한다.
- challenge consume과 Account/Profile/PasswordCredential 생성은 기존 하나의 Service transaction에 남는다.
- Profile 또는 PasswordCredential insert가 실패하면 challenge consume과 앞선 Account insert가 모두 rollback된다.
- Repository는 전달받은 `DbExecutor`를 사용하며 DB 연결이나 transaction을 직접 소유하지 않는다.
- Credential에는 검증된 email과 non-null `email_verified_at`이 기록된다.

### Options considered

1. consume UPDATE에서 `verifiedAt: null`을 함께 설정한다. 현재 CHECK와 상태 의미를 그대로 유지하며 migration 없이 Repository 한 곳만 수정한다.
2. `CONSUMED`에서도 `verified_at`을 허용하도록 CHECK를 변경한다. 원래 OTP 검증 시각을 보존하지만 상태 계약, `schema.ts`, 새 ALTER migration과 Drizzle metadata를 함께 바꾸는 별도 정책 결정이 필요하다.
3. verified-at CHECK를 삭제하거나 느슨하게 만든다. DB가 잘못된 상태/시각 조합을 허용하므로 선택하지 않는다.

### Recommended minimal change

옵션 1을 선택한다. `consumeVerifiedChallenge()`의 기존 UPDATE payload에 `verifiedAt: null`만 추가한다.

```ts
.set({ status: "CONSUMED", verifiedAt: null, consumedAt: now })
```

기존 `WHERE id = ? AND status = 'VERIFIED'`, `returning({ email })`, Service transaction과 HTTP contract는 유지한다. Schema 또는 migration 변경은 없다.

### Expected files to change

- `src/server/repositories/email-verification-repository.ts`
- `src/server/repositories/email-verification-repository.test.ts` — consume 상태 payload 회귀 테스트 신규 추가
- 이 evidence 파일 — IMPLEMENT/VERIFICATION/REVIEW 단계 기록만 갱신

격리 PostgreSQL 검증용 `.local` test/evidence 파일은 필요하면 생성하거나 갱신할 수 있지만 commit 대상에는 포함하지 않는다.

### Files explicitly not to change

- `src/server/db/schema.ts`
- `drizzle/0002_email_verification_challenge.sql` 및 `drizzle/meta/*`
- `src/server/services/signup-service.ts`
- Route Handler와 HTTP/Zod contract
- Architecture 및 Domain Specification
- DATA-003, DATA-004, DATA-009 관련 코드
- 이번 finding과 무관한 `.agents` 작업 파일

### Tests required

1. Repository 회귀 테스트에서 consume UPDATE가 `status: 'CONSUMED'`, `verifiedAt: null`, `consumedAt: now`를 한 번에 설정하고 email을 반환하는 기존 chain을 유지하는지 확인한다.
2. 실제 PostgreSQL 17 임시 DB에서 정상 흐름을 실행한다.
   - `requestOtp → verifyOtp → completeSignup` 성공
   - challenge는 `CONSUMED`, `verified_at IS NULL`, `consumed_at IS NOT NULL`
   - ACTIVE Account/Profile/PasswordCredential 생성 및 Credential의 verified email 확인
3. 같은 challenge 재소비가 `OTP_NOT_VERIFIED`로 실패하고 identity row를 추가하지 않는지 확인한다.
4. 후반 insert 실패 rollback을 실제 PostgreSQL에서 확인한다.
   - duplicate nickname으로 Profile insert 실패 시 challenge가 `VERIFIED`, `verified_at IS NOT NULL`, `consumed_at IS NULL`로 복원되고 새 Account가 남지 않음
   - duplicate email로 PasswordCredential insert 실패 시에도 같은 rollback invariant가 성립함
5. 다음 repository gate를 실행한다.
   - `pnpm type-check`
   - `pnpm test:harness`
   - `pnpm lint`
   - `pnpm lint:fsd`
   - `pnpm test:unit:run`
   - `pnpm format:check`
   - `pnpm build`

### PostgreSQL verification required

- `compose.dev.yml`의 PostgreSQL 17을 사용한다.
- 기존 `oioibawige` DB에는 migration이나 fixture를 적용하지 않는다.
- 고유한 임시 DB를 생성하고 명시적인 임시 `DATABASE_URL`로 local database guard를 통과한 뒤 migration 0000~0003을 적용한다.
- 실제 Repository/Service를 사용한다. 외부 OCI 메일 전송만 spy로 대체한다.
- 정상 완료, 재소비, Profile 실패 rollback, PasswordCredential 실패 rollback을 검증한다.
- 연결을 닫고 임시 DB를 삭제하며, 실행 명령과 관찰 결과를 이 파일의 VERIFICATION에 기록한다.

### Risks / unknowns

- 최소안은 challenge가 소비된 뒤 원래 OTP `verified_at`을 제거한다. 현재 명세에는 보존 요구가 없지만 감사/운영 요구가 새로 확인되면 schema 정책 결정이 필요하다.
- `password_credential.email_verified_at`은 현재 OTP 검증 시각이 아니라 `completeSignup()` 시각을 사용한다. 이 finding은 기존 의미를 바꾸지 않는다.
- 현재 일반 Vitest suite에는 실제 PostgreSQL lifecycle이 없다. commit되는 작은 Repository 회귀 테스트와 격리 PostgreSQL 실검증을 함께 사용하며, 공용 integration harness 구축은 DATA-008 범위로 남긴다.
- 기존 local application DB에는 migration 0002/0003이 적용되지 않았으므로 검증 대상으로 사용할 수 없다.

### Escalation conditions

다음 중 하나가 확인되면 IMPLEMENT를 중단하고 ESCALATE한다.

- 소비 후에도 원래 OTP `verified_at`을 보존해야 한다는 domain/운영 근거가 발견됨
- CHECK 변경, schema 수정 또는 새 migration이 필요함
- 위 expected file 범위 밖의 tracked code 변경이 필요함
- 실제 PostgreSQL 결과가 계획한 상태 전이나 rollback invariant와 다름
- DATA-003/004의 오류 매핑 또는 민감 로그 수정 없이는 DATA-001 검증 자체를 완료할 수 없음

Implementation handoff:
Run `/m7-implement DATA-001`.
Canonical plan: `docs/migration/m7-foundation-fixes/DATA-001.md`

## IMPLEMENTATION

### Changed files

- `src/server/repositories/email-verification-repository.ts`
- `src/server/repositories/email-verification-repository.test.ts`
- `docs/migration/m7-foundation-fixes/DATA-001.md`

검증 전용으로 `.local/m7-data-001-verification.config.ts`와 `.local/m7-data-001-verification.test.ts`를 생성했다. 두 파일은 Git ignore 대상이며 commit 범위에 포함하지 않는다.

### Implemented decision

`consumeVerifiedChallenge()`의 조건부 단일 UPDATE에 `verifiedAt: null`을 추가했다.

```ts
.set({ status: "CONSUMED", verifiedAt: null, consumedAt: now })
```

기존 `DbExecutor`, `WHERE id/status`, email 반환, Service transaction, schema와 migration을 유지했다. 이 변경으로 현재 verified-at/consumed-at CHECK를 동시에 만족한다.

### Deviations from PLAN

- 구현 범위와 정책 결정의 deviation은 없다.
- 표준 `pnpm` 명령은 실행 전에 자동 dependency install 검사가 시작되어 `ERR_PNPM_IGNORED_BUILDS`로 중단됐다. dependency 승인이나 workspace 설정을 바꾸지 않고 설치된 local binary로 같은 type-check/test/lint/format/build 명령을 실행했다.
- `pnpm` 선행 검사에서 `pnpm-workspace.yaml`에 임시로 추가된 `allowBuilds` 항목은 DATA-001 범위 밖이고 작업 시작 시 없던 변경이므로 원상 복구했다.

### Tests added/changed

- `email-verification-repository.test.ts`: consume이 `CONSUMED`, `verifiedAt: null`, `consumedAt`을 한 UPDATE payload로 설정하고 기존 email 반환 chain을 유지하는지 검증한다.
- 격리 PostgreSQL 검증: 정상 signup과 재소비 거부, Profile unique 실패 rollback, PasswordCredential email unique 실패 rollback을 실제 Repository/Service와 PostgreSQL 17에서 검증한다.

## VERIFICATION

### Commands run and results

- `pnpm exec vitest run src/server/repositories/email-verification-repository.test.ts --reporter=verbose`
  - 테스트 실행 전 dependency install 검사에서 `ERR_PNPM_IGNORED_BUILDS`로 중단됐다.
- `node node_modules/vitest/vitest.mjs run src/server/repositories/email-verification-repository.test.ts --reporter=verbose`
  - 통과: 1 file, 1 test.
- `pnpm type-check`
  - TypeScript 실행 전 같은 `ERR_PNPM_IGNORED_BUILDS`로 중단됐다.
- `node node_modules/typescript/bin/tsc --noEmit`
  - 통과.
- `node --test eslint-rules/*.test.js`
  - 통과: 7 tests.
- `./node_modules/.bin/steiger ./src`
  - 통과: 문제 없음.
- `node node_modules/vitest/vitest.mjs run`
  - 통과: 34 files, 110 tests.
- `node node_modules/next/dist/bin/next build`
  - 통과: compile, TypeScript, page data, 23개 static page 생성 완료.
- 변경 파일 대상 ESLint
  - 통과: Repository source/test와 DATA-001 로컬 검증 파일에 문제 없음.
- `node node_modules/prettier/bin/prettier.cjs --check .`
  - 통과: 전체 대상 파일이 Prettier 형식과 일치.
- `node node_modules/eslint/bin/eslint.js .`
  - 실패: 기존 `.local/m7-local-read.test.ts`의 `no-explicit-any` 3건과 `.local/m7-verification.test.ts`의 `no-explicit-any` 1건. 같은 기존 파일의 unused import warning 2건도 존재한다. DATA-001 변경 파일에서는 오류가 없다.

### PostgreSQL verification

- Docker Compose PostgreSQL 17의 신규 임시 DB `m7_data_001_20260906_0157`만 사용했다.
- 명시적인 localhost `DATABASE_URL`로 `scripts/assert-local-database.ts` guard를 통과했다.
- Drizzle migration 0000~0003을 임시 DB에 적용했다.
- 실제 Repository/Service와 OCI mail spy를 사용한 Vitest 결과: 1 file, 3 tests 모두 통과.
  - `requestOtp → verifyOtp → completeSignup` 성공.
  - challenge는 `CONSUMED`, `verified_at IS NULL`, `consumed_at IS NOT NULL`.
  - ACTIVE Account/Profile/PasswordCredential과 verified email 생성.
  - 같은 challenge 재소비는 `OTP_NOT_VERIFIED`, Account 수 불변.
  - Profile unique 실패 후 challenge는 `VERIFIED`, `verified_at IS NOT NULL`, `consumed_at IS NULL`, Account 수 불변.
  - PasswordCredential email unique 실패 후 challenge와 Account/Profile insert 모두 rollback.
- 검증 종료 후 임시 DB 연결 수 0을 확인하고 DB를 삭제했다. 삭제 후 `pg_database` 조회 결과는 0이다.
- 기존 local application DB에는 연결하거나 migration/fixture를 적용하지 않았다.

### Failures and remaining unknowns

- 실제 수정, regression test, PostgreSQL 검증, type-check, harness, FSD, unit, format, build는 통과했다.
- 전체 ESLint gate는 이번 변경과 무관한 기존 `.local` 검증 파일 오류 때문에 실패 상태다. 따라서 Status는 `VERIFIED`가 아니라 `IMPLEMENTED`로 유지한다.
- 소비 후 원래 OTP 검증 시각을 보존하지 않는 현재 PLAN의 정책 전제는 그대로다.

## REVIEW

### Verdict

APPROVE WITH MINOR FIX

### Findings by severity

#### Minor — required full lint gate is not green

`node node_modules/eslint/bin/eslint.js .`은 DATA-001과 무관한 기존 ignored `.local/m7-local-read.test.ts`의 `no-explicit-any` 3건과 `.local/m7-verification.test.ts`의 `no-explicit-any` 1건 때문에 실패했다. 두 파일의 unused import warning 2건도 남아 있다.

DATA-001의 tracked source/test와 검증용 DATA-001 로컬 파일은 lint를 통과했다. Review에서 `.local`을 제외한 repository 범위로 `node node_modules/eslint/bin/eslint.js . --ignore-pattern .local`을 실행한 결과도 통과했다. 따라서 구현 diff의 결함은 아니지만 PLAN에 명시된 전체 lint gate 실패 때문에 `CLOSED`로 판정할 수 없다.

### Blocking issues

없음. DATA-001 구현에서 root cause, transaction, concurrency, authorization, sensitive data, API contract, cache ownership 또는 architecture 위반은 발견되지 않았다.

### Minor issues

- 전체 workspace lint evidence를 green으로 만들어야 한다. 기존 `.local` 검증 파일을 정리하거나 clean checkout/worktree에서 required lint gate를 다시 실행해야 한다.

### Remaining risks

- 승인된 PLAN대로 `CONSUMED` challenge는 원래 OTP `verified_at`을 보존하지 않는다. 현재 Domain Specification에는 보존 요구가 없다.
- 실제 PostgreSQL regression suite는 `.local` evidence이며 일반 unit suite에 포함되지 않는다. 공용 integration test lifecycle은 DATA-008 범위다.

### Reviewer recommendation

코드 수정안은 그대로 승인한다. 기존 `.local` lint 오류의 영향을 받지 않는 clean repository 환경에서 required lint gate를 통과시킨 뒤 `/m7-review DATA-001`을 다시 실행해 `CLOSED`로 전환한다.

Review에서 추가 확인한 결과:

- `node node_modules/eslint/bin/eslint.js . --ignore-pattern .local`: 통과.
- DATA-001 Repository regression test: 1 file, 1 test 통과.
- DATA-001 source/test/evidence 대상 Prettier check: 통과.
- 임시 PostgreSQL DB `m7_data_001_20260906_0157`이 삭제된 상태임을 catalog에서 재확인했다.

### Re-review — clean lint gate

#### Verdict

APPROVE

#### Resolved finding

기존 `.local` 검증 파일이 없는 clean detached worktree를 `3b5743e`에서 생성하고 DATA-001의 Repository source/test diff만 적용했다. 기존 설치된 `node_modules`를 재사용하고 pnpm 10의 자동 dependency install 검사만 `pnpm_config_verify_deps_before_run=false`로 비활성화한 뒤 실제 repository script를 실행했다.

```text
pnpm lint
→ eslint
→ exit 0
```

이로써 이전 review의 유일한 minor finding인 required full lint gate 미통과가 해소됐다. 임시 worktree는 검증 후 제거했다.

#### Final findings

Blocking, major, minor finding 없음.

#### Final recommendation

DATA-001을 `CLOSED`로 전환한다. 구현 diff는 승인된 PLAN과 일치하고, Repository regression, 실제 PostgreSQL 정상/재소비/rollback 검증, type-check, harness, FSD, unit, lint, format, build evidence가 모두 갖춰졌다.
