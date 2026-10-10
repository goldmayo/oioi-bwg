---
title: "P05-B1 Console MFA 암호화와 TOTP 검증 기반 계획"
kind: migration-plan
status: active
source_commit: 7c65c9a999321a9b28bee1a5cebf9d675ff4fac4
created_at: "2026-10-10"
---

# P05-B1 계획

[P05 설계 §3·5·7·8](P05-DESIGN.md)의 B를 독립 검증 가능한 PR로 나눈다.
PR #121의 `29ec74c` Verify 필수 job 성공을 확인하고 squash 병합한 위 커밋이 기준이다.
작업 트리는 깨끗했고 fetch한 최신 `origin/migration_main`에서
`feature/p05b1-admin-mfa-crypto`를 만들었다. 기존 동명 local/remote 브랜치는 없었다.

상위 기준은 [헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Auth §4.1](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Domain AUTH-009](../../DOMAIN_SPECIFICATION.md),
[Server](../../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md)이다.

1. `packages/server/src/auth`에 AES-256-GCM의 32-byte key 검증과 secret 암복호화를 구현한다.
   envelope format v1, 무작위 12-byte nonce, 16-byte tag, Account ID/format AAD를 사용한다.
   MFA 회수 version은 AAD에 넣지 않는다. key는 인자로 전달하고 env를 읽지 않는다.
2. otplib `13.5.0`을 고정하고 secret 생성·6자리 SHA-1/30초 TOTP 검증을 구현한다.
   서버 epoch(초), 허용 ±30초, 실제 검증 timeStep과 afterTimeStep 계약을 타입/테스트로 확인한다.
3. 잘못된 envelope/key/AAD/변조, RFC token과 시간 경계/허용 범위/재사용 하한을 검증한다.
   실패에는 key/secret/OTP/원본 crypto 오류를 포함하지 않는다.
4. 기본 여섯 검사와 로컬 DATABASE_URL을 명시한 두 앱 build를 실행한다.

B1은 DB 쓰기/세션 발급이 없으며 OTP 원자 소모 완료를 주장하지 않는다.
B2는 등록/confirm/로그인·회수 core와 실제 PostgreSQL 경합, B3는 guarded CLI/운영 절차를 다룬다.
후속 구현에서 Account → credential → MFA lock과 최종 credential/ACTIVE ADMIN/version/secret 재검사를 검증한다.
runtime key env adapter·QR·Auth.js/guard·limiter·HTTP/UI·Web 전체 회수·P06 공개 배포는 이 PR에 넣지 않는다.
검증 후 한글 commit/push 및 migration_main 대상 PR 생성까지 진행하며 새 PR은 병합하지 않는다.
