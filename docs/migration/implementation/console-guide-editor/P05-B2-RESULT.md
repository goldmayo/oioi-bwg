---
title: "P05-B2 Console MFA 원자 소모와 회수 core 결과"
kind: migration-result
status: completed
source_commit: 1165ebbd28457e9a983442d554be41b61ced0a6d
created_at: "2026-10-10"
---

# P05-B2 결과

[계획](P05-B2-PLAN.md)의 core 구현·검증 source는 위 커밋이다. PR #122는 최신
[Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/38017887193) 필수 job 성공 후 `d42113a`로 병합했다.
이번 브랜치는 그 최신 `migration_main`에서 분기했고 사용자 변경은 없었다.

setup은 저장된 pending secret/version, confirm은 성공 여부만 반환하며 최초 step을 소모한다.
로그인은 조건부 UPDATE 반환 행이 하나일 때만 `{ id, mfaVerified, mfaVersion }`을 반환한다.
비밀번호·암복호화·TOTP는 lock 밖에서 처리하고, 최종 transaction은 Account → credential → MFA를
잠가 현재 ACTIVE ADMIN과 credential 전체 snapshot을 재확인한다. UPDATE는 검증 당시 secret/version/활성 시점과
실제 matched step 하한을 비교한다. reset과 운영 access 변경도 같은 lock 순서를 따른다.
운영 기대값 실패는 FORBIDDEN이며 version 없음을 null로 구분한다. reset은 행을 보존하고,
access 변경/복귀는 secret/step을 보존하면서 version을 증가시킨다. PENDING/DELETED 전환은 제공하지 않는다.

- `pnpm test:integration:postgres:local` **30/30 통과**(기존 17 + 신규 13).
  Compose PostgreSQL 17의 격리 DB·runtime app role에서 저장 pending 일치/중복 confirm,
  실제 transaction lock 대기 중 동일 OTP 단일 소모·최초 행 생성/access 경합·로그인 선행/reset 후행,
  검증 후 reset·role/status·credential 변경 거절, 실제 matched step 저장, 기대값 실패와 version 보존을 검증했다.
  PostgreSQL integer overflow 오류로 Account 변경과 MFA 증가/reset의 rollback을 확인했다.
  spy는 경합 일정만 제어하며 DB 결과를 mock하지 않았다. 임시 DB/role 정리, 잔여 connection/advisory lock 0.
  초기 두 실행은 server 의존성의 root import 해석 실패였고 소유 package 기준 해석/기존 명시적 fixture hash로 보완했다.
- `pnpm type-check`, `pnpm test:harness`(**18건**), `pnpm lint`, `pnpm lint:fsd`,
  `pnpm test:unit:run`(**417건**), `pnpm format:check` 모두 통과. B1 리뷰의 OTP 타입 방어도 반영했다.
- Compose loopback DATABASE_URL과 `SENTRY_SOURCE_MAPS_ENABLED=false`를 전달한
  `pnpm build --env-mode=loose --force`는 두 앱 모두 캐시 없이 통과했다.
- pre-commit 자동 `eslint --fix` / `prettier --write` 통과. pre-push 결과는 PR에 직접 검사와 분리해 기록한다.

새 schema/migration·운영 seed·production DB 작업은 없다. B3 guarded CLI/운영 절차,
C/D의 등록 허용 설정·QR·Zod/Origin/limiter·Auth.js/guard·HTTP/UI 연결은 남는다.
아직 실제 JWT를 발급/검증하지 않았으며 복귀 후 옛 JWT 거절은 version DB facts까지만 검증했다.
탈퇴 개인정보 제거 service와 Web 전체 Session 회수는 구현하지 않았다. 탈퇴의 secret 제거·tombstone 정책과
[runtime 직접 SQL 권한 한계](P05-A-RESULT.md#pr-121-리뷰-보완-2026-10-10)는 유지한다.
P05-B 전체 완료나 P06 공개 배포/HTTPS/Web Admin 종료를 의미하지 않는다.
