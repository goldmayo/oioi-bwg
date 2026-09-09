---
title: "Persistence error boundary 강화 계획"
document_id: "PERSISTENCE-ERROR-BOUNDARY-PLAN"
version: "1.0"
status: "completed"
authority: "plan"
updated_at: "2026-09-09"
depends_on:
  - "03"
  - "06"
  - "10"
---

# Persistence error boundary 강화 계획

## 목적과 기준선

`migration_develop` commit `2f0cf79619d850b2481ca97430dfe57dfd8b3368`의 Service에 노출된
PostgreSQL/Drizzle unique violation 판별을 persistence boundary 아래로 이동한다. 외부 API
contract과 transaction ownership은 변경하지 않는다.

## 근거

- Architecture Constitution `01` §2~4: PostgreSQL 17과 Drizzle 스택을 유지한다.
- API/Error Architecture `03` §6~8: Service는 HTTP와 분리된 application failure만
  `AppError`로 표현한다.
- Server/Data Access Architecture `06` §18~19.1, §48~49: Repository가 persistence concern과
  known physical error의 semantic translation을 소유하고 unknown error identity를 보존한다.
- Testing Architecture `10` §5~7: Service expected error, Repository constraint, public error contract을
  서로 다른 경계에서 검증한다.

## 범위

- PostgreSQL/Drizzle predicate를 `src/server/db` adapter로 이동
- album slug, song slug, profile nickname, password credential email의 명시적 semantic
  repository error 추가
- 각 write repository의 exact physical constraint translation
- Service의 semantic repository error → 기존 `AppError` code translation
- Service의 DB-specific import를 금지하는 architecture lint guard
- adapter, repository, service, PostgreSQL integration regression 검증

## 비범위

- DB/ORM/schema/migration/constraint/DTO/API/authz/transaction ownership 변경
- Repository class, generic exception hierarchy, DI container 도입
- known constraint 외 DB failure의 application error 변환

## 전략

1. DB adapter는 direct `DrizzleQueryError.cause`의 exact SQLSTATE/constraint만 판별한다.
2. 각 write repository는 자신의 known constraint만 구체 semantic error로 번역한다.
3. Service unit test는 semantic error를 주입해 public `AppError` mapping을 검증한다.
4. Repository unit/integration test는 physical error translation과 unknown error identity 보존을 검증한다.
5. ESLint harness는 Service의 `drizzle-orm`, `postgres`, DB vendor error adapter import를 차단한다.

## 완료 조건

- 기존 네 `AppError` code와 409 error response가 유지된다.
- signup conflict의 transaction rollback과 challenge 상태가 유지된다.
- Service source/test에 DB vendor/ORM/SQLSTATE/physical constraint 지식이 남지 않는다.
- `pnpm verify`, `pnpm format:check`, `pnpm test:integration:postgres:local`, `pnpm build`가
  통과한다.

## 위험과 중단 조건

- transaction callback에서 번역된 error identity가 변경되는지 실제 PostgreSQL로 검증한다.
- unknown constraint가 semantic conflict로 변환되면 구현을 중단하고 exact match 범위를
  수정한다.
- 스키마나 public contract 변경이 필요하면 이 계획의 범위를 넘으므로 별도로
  escalation한다.
