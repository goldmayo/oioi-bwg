---
title: "P05-C1 Console MFA 세션과 guard 계획"
kind: migration-plan
status: active
source_commit: 9829b1b6724da3aadfb2fda0fd835bfb3b756cee
created_at: "2026-10-10"
---

# P05-C1 계획

PR #124의 최신 Verify 성공과 사용자 승인 후 위 squash head를 fetch했다. 사용자 변경과 기존 동명
브랜치 없이 최신 `migration_main`에서 `feature/p05c1-console-mfa-session`을 만들었다.
[P05 §4~8](P05-DESIGN.md), [Auth §4.1](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Domain AUTH-006/009](../../DOMAIN_SPECIFICATION.md), [Server](../../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md)를 따른다.

C는 C1 세션/guard → C2 limiter·Origin/CSRF로 나눈다. C1은 비밀번호+6자리 OTP를 Zod 검증하고 B2 core로
원자 소모한 identity만 Auth.js에 전달한다. runtime MFA key는 Console server adapter에서 읽어 명시적으로
전달하며 build에서는 읽지 않는다. JWT application claims는 sub/proof/version만 보존하고 client session.update
주입은 무시한다. guard는 증명·양의 정수 version과 단일 Account/MFA join의 활성/version/ACTIVE ADMIN을
확인한 뒤 기존 context/CASL을 만든다. password-only/미등록/회수된 증명은 guest → 기존 보호 API 401이다.

기존 격리 admin runner의 Console fixture만 B2 setup/confirm으로 사전 등록하고 실제 Auth.js callback
로그인으로 전환한다. 일반 로그인/등록 UI는 D이며 기존 폼으로 세션을 발급하는 우회는 두지 않는다.
실제 JWT 발급/반복 조회/session.update/password-only·만료·다른 앱 cookie 거절, CLI 강등/복귀·정지/복귀·
reset/재등록 후 옛 JWT 거절과 다음 OTP 로그인, 편집 초안 보존을 검증한다. 테스트 secret/key는 process memory에만 둔다.
기본 여섯 검사·실제 Compose PostgreSQL·admin standalone/browser smoke·두 앱 build를 실행한다.

C1은 아직 limiter/Origin의 P05-C 전체 완료나 공개 인증을 의미하지 않는다. loopback 접근 제한은 유지한다.
등록 endpoint/QR/UI, HTTPS·신뢰 proxy IP·production 실행, Web Admin 제거와 Web 전체 Session 회수는 보류한다.
commit/push/PR까지 진행하고 새 PR은 병합하지 않는다.
