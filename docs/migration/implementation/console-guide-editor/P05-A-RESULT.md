---
title: "P05-A Console MFA persistence 기반 결과"
kind: migration-result
status: completed
source_commit: c9396c97f90b7f6d9add5b4bfdba01a9f26f4b83
created_at: "2026-10-10"
---

# P05-A 결과

[계획](P05-A-PLAN.md)의 구현·검증 source는 위 커밋이며 최종 PR은
`feature/p05a-admin-mfa-foundation → migration_main`이다. 새 PR 병합/P05-B 착수는 포함하지 않는다.
Auth §4.1·29 / Domain AUTH-009와 탈퇴·PII 정책, additive `0005_p05a_admin_mfa`,
executor 기반 조회/pending/reset/version 증가, 실제 PostgreSQL 회귀를 추가했다.
계획의 보완으로 runtime role allowlist와 기존 migration hash/ownership 기대값을 함께 갱신했다.

SQL은 새 테이블과 PK/FK RESTRICT·CHECK만 추가하며 기존 데이터 UPDATE/seed는 없다.
integer version/step은 JS에서 정확하게 표현되고 overflow 시 실패한다. PK가 FK 조회도 지원해 별도 index는 없다.
pending은 [PostgreSQL UPSERT/RETURNING](https://www.postgresql.org/docs/17/sql-insert.html)의 저장 행 snapshot을 반환한다.
DB CHECK는 양수 version/유효 상태를 보호하며 임의 SQL의 감소/DELETE까지 막는 trigger는 없다.

- `pnpm db:generate --name=p05a_admin_mfa` → 생성 SQL 검토 후 `pnpm test:integration:postgres:local` 적용.
  첫 실행은 allowlist 누락·0004까지의 기존 기대값으로 실패했고 보완 후 **17/17 통과**(새 MFA 6건).
  guarded loopback Compose PostgreSQL 17, runtime app role로 CHECK/PK/FK·실제 lock 대기 중 동시 최초 생성·
  저장 pending snapshot 일치·활성 secret 교체 거절·동시 reset/version 증가·재등록·tombstone·tx rollback 확인.
  임시 DB/role 정리 완료, 잔여 connection/advisory lock 0. 운영 DB 검증/적용은 수행하지 않았다.
- `pnpm type-check`, `pnpm test:harness`(18건), `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run`(406건), `pnpm format:check` 통과. lint 첫 실행은 harness 임시 파일 삭제와
  경합해 ENOENT였고 harness 종료 후 재실행 통과했다. 무관한 검사 도구 수정은 하지 않았다.
- `pnpm build` 통과. 기존 env를 읽은 첫 build는 DB 연결 검증 근거로 사용하지 않는다.
  Compose loopback DATABASE_URL을 전달한 `pnpm build --env-mode=loose --force`도 두 앱 모두 통과했다.
- pre-commit hook의 `eslint --fix` / `prettier --write` 통과. pre-push 자동 검증 결과는 직접 실행과 분리해 PR에 기록한다.

암호화 envelope/QR·TOTP 원자 소모·인가/회수 service·CLI·Auth.js/guard·limiter·등록 API/UI는 P05-B~D다.
회수 service의 role/status 동시 commit·복귀 후 JWT 거절·QR 응답 검증은 아직 완료하지 않았다.
UX/라이브러리 버전/실패 한도는 보류한다. Web 전체 Session 회수도 기존 미구현이며 Console version으로 대체하지 않는다.
P06의 공개 배포/HTTPS/Web Admin 종료는 남는다. P05-A 결과는 P05 인증 runtime 완료를 의미하지 않는다.
