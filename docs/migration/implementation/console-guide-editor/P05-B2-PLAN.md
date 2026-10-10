---
title: "P05-B2 Console MFA 원자 소모와 회수 core 계획"
kind: migration-plan
status: active
source_commit: d42113aafb1391e7683bd6203ca4e68ff878de32
created_at: "2026-10-10"
---

# P05-B2 계획

PR #122의 최신 Verify 성공 후 위 squash commit을 fetch했다. 사용자 변경 없는 작업 트리에서
최신 `origin/migration_main` 기준 `feature/p05b2-admin-mfa-core`를 만들었다. 기존 동명 브랜치는 없었다.
[B1 계획](P05-B1-PLAN.md)과 [P05 설계 §4·5·7](P05-DESIGN.md)의 다음 구현 단위다.
상위 기준은 [헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Auth §4.1](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Domain AUTH-009·7.2](../../DOMAIN_SPECIFICATION.md),
[Server](../../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md)이다.

- setup/confirm/login은 매번 정규화 Email/비밀번호와 ACTIVE ADMIN을 확인한다. setup은 저장된
  pending secret/version을 반환하고 confirm은 최초 실제 step을 소모한다. 등록은 identity를 발급하지 않는다.
- Argon2/암복호화/TOTP는 lock 밖에서 수행한다. 최종 transaction에서 Account → credential → MFA
  순서로 잠그고 credential 전체 snapshot·현재 ACTIVE ADMIN을 재검사한다. 조건부 UPDATE는
  검증 당시 version/secret/활성 시점과 step 하한을 비교하며 반환 행이 정확히 하나일 때만 성공한다.
- reset은 기대 version(미등록은 null)을 비교하며 행/증가 version을 보존한다. 운영 role/status 변경과
  회수는 같은 transaction이다. 활성 secret/사용 step은 보존하고 복귀/재승격도 version을 증가시킨다.
- 운영 access core는 ACTIVE/SUSPENDED 계정만 다룬다. PENDING 활성화와 DELETED 전환/복구는
  가입·탈퇴의 credential/profile 생명주기를 우회하므로 제공하지 않는다. 탈퇴의 secret 제거 규칙은 유지한다.
- B1 리뷰의 OTP runtime 타입 방어를 추가한다. HTTP Zod 검증·등록 허용 설정·QR·limiter·Auth.js/guard는
  후속 adapter 책임이며 지금 HTTP 경로는 열지 않는다. 운영 함수의 호출자는 B3의 guarded CLI다.
- 기존 격리 runner/Compose PostgreSQL에서 동시 소모·setup/confirm/reset·credential 변경 경합,
  기대값 실패·Account/version rollback·복귀 후 version 불일치를 검증한다. lock 대기를 관찰한다.
  기본 여섯 검사와 두 앱 build도 실행한다. seed·production 연결·schema migration은 추가하지 않는다.

등록/소모/회수와 lock 순서가 하나의 보안 계약이므로 결합한 테스트까지 400줄을 넘으면
PR에 결합 이유와 리뷰 순서를 명시한다. B3 CLI/운영 절차와 C/D runtime 연결은 보류한다.
Web 전체 Session 회수와 DB 직접 SQL 우회 차단도 완료로 주장하지 않는다.
검증 후 별도 한글 commit/push/PR까지 진행하고 이번 새 PR은 병합하지 않는다.
