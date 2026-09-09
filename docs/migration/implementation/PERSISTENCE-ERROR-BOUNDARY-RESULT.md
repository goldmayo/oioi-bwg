---
title: "Persistence error boundary 강화 결과"
document_id: "PERSISTENCE-ERROR-BOUNDARY-RESULT"
version: "1.0"
status: "completed"
authority: "result"
updated_at: "2026-09-09"
depends_on:
  - "PERSISTENCE-ERROR-BOUNDARY-PLAN"
---

# Persistence error boundary 강화 결과

## 기준과 구현 ref

- 기준: `migration_develop` commit `2f0cf79619d850b2481ca97430dfe57dfd8b3368`
- 구현: commit `2867d13db6f68452434c09d536f91e63fdd73971`
- 계획: [`PERSISTENCE-ERROR-BOUNDARY-PLAN.md`](./PERSISTENCE-ERROR-BOUNDARY-PLAN.md)

## 실제 변경

- PostgreSQL/Drizzle unique violation predicate를 `src/server/errors`에서 `src/server/db`로
  이동했다.
- album slug, song slug, profile nickname, password credential email에 대한 명시적
  repository semantic error를 추가했다.
- 각 write repository가 exact known physical constraint만 semantic error로 번역하고, unknown
  constraint와 unrelated error는 원래 identity로 전파하게 했다.
- Album, Song, signup Service는 semantic repository error만 기존 `AppError` code로
  번역하게 했다.
- custom ESLint architecture rule에 Service의 `drizzle-orm`, `postgres`, PostgreSQL error adapter
  import 금지를 추가했다.
- Server/Data Access Architecture 06에 persistence error translation boundary와 unknown error
  identity 보존 규칙을 반영했다.

## 계획 대비 차이

없다. DB/ORM, schema/migration, public DTO/API contract, authz, transaction ownership은 변경하지
않았다.

## 검증

- `pnpm exec vitest run src/server/db/postgres-error.test.ts src/server/repositories/repository-conflict-error.test.ts src/server/services/album-service.test.ts src/server/services/song-service.test.ts src/server/services/signup-service.test.ts`
  - 5 files, 39 tests 통과
- `pnpm type-check`
  - 통과
- `pnpm test:harness`
  - 8 tests 통과
- `pnpm verify`
  - type-check, architecture harness, ESLint, Steiger, 47 unit files/195 tests 통과
- `pnpm test:integration:postgres:local`
  - PostgreSQL 17, 9 tests 통과
  - signup nickname/email conflict rollback과 challenge 상태 보존 확인
  - 실제 Album/Song unique constraint의 기존 409 contract 확인
  - 임시 DB의 connection/advisory lock 0건 확인 후 삭제
- `pnpm format:check`
  - 통과
- `pnpm build`
  - Next.js 16.3.3 production build 통과
- `rg`로 `src/server/services/**`의 `DrizzleQueryError`, `isPostgresUniqueViolation`, SQLSTATE
  `23505`, four physical constraint name을 검색했고 0건을 확인했다.

## 의도적으로 남은 DB-specific dependency

- `src/server/db/postgres-error.ts`: `DrizzleQueryError`, SQLSTATE, PostgreSQL error shape 판별
- `src/server/repositories/*-repository.ts`: 각 write가 소유한 physical constraint allowlist
- `src/server/db/schema.ts`, `drizzle/`: 현재 PostgreSQL/Drizzle schema와 migration
- `src/server/observability/safe-server-event.ts`: Drizzle error를 외부에 노출하지 않기 위한
  server-boundary sanitization

Service에는 PostgreSQL, Drizzle, SQLSTATE, physical constraint name 의존성이 남지 않는다.

## 남은 간격

없다. Production DB에는 연결하지 않았다.
