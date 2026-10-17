---
title: "P05-C2 로그인 제한과 Origin/CSRF 계획"
kind: migration-plan
status: active
authority: plan
source_commit: 4313eec2e6aedfed8b1a38174f8bb0d5aac81920
created_at: "2026-10-10"
updated_at: "2026-10-10"
---

# P05-C2 실행 계획

사용자 승인과 최신 Verify 성공을 확인한 PR #125를 squash 병합한 위 merge head에서
`feature/p05c2-console-auth-boundary`를 만든다. 최초 작업 트리는 깨끗했다.
상위 기준은 [헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Auth §4.1·26·27](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[Server](../../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md),
[Domain AUTH-009](../../DOMAIN_SPECIFICATION.md#auth-009-console-mfa-등록과-회수),
[P05 설계 §4·6·8](P05-DESIGN.md), [C1 결과](P05-C1-RESULT.md)다.

## 결정과 범위

- `rate-limiter-flexible@11.2.1`의 실제 설치 소스/타입과 공식 문서를 확인한다.
  계정(trim/lowercase 후 SHA-256)당 5분에 5회, IP당 5분에 20회로 제안을 확정한다.
  P05에는 신뢰 IP 전달 계약이 없으므로 모든 요청을 unknown IP bucket에 넣고 XFF를 무시한다.
- 최종 authorize의 Zod 입력 검증 다음, Argon2/DB 인증 전에 예약한다. Action 및 callback이
  같은 process singleton을 쓴다. 실패/내부 오류는 예약을 유지하고 성공만 자기 예약을 환급한다.
  계정 key 최대 1,024개와 5분 TTL을 적용한다. 상한에서는 제한을 생략하지 않고 거절한다.
  오래된 성공의 환급은 만료/교체된 window에 적용하지 않는다.
- 예상된 제한만 `CredentialsSignin` 하위 `LoginRateLimited`로 변환한다.
  Action은 code/양의 정수 retryAfterSeconds를 반환하고 직접 callback은 표준 rate_limited
  redirect 계약을 따른다. 정상 CredentialsSignin과 제한은 기존 AUTH_FAILURE/Sentry 제외를 유지한다.
- Auth.js 모든 POST, 로그인/로그아웃/이미지 업로드 Action, 관리 POST/PATCH/DELETE에
  configured Console Origin 정확 비교를 적용한다. 누락/null/Web/외부 Origin을 거절한다.
  JSON 입력은 application/json으로 제한한다. Next 자체 Action Origin/Host 및 Auth.js CSRF를 유지한다.
  GET은 mutation을 수행하지 않는다. CORS/새 CSRF framework/proxy 인증 우회를 만들지 않는다.
- D의 등록 API/UI/QR, P06 공개/HTTPS/Secure cookie/신뢰 proxy IP/복수 process 제한,
  Web 전체 Session 회수는 이번 범위 밖이다. 일반 폼의 OTP 입력은 D까지 미완성이다.
  미래 setup/confirm은 같은 예약 함수를 사용하되 이번에 빈 endpoint/container를 만들지 않는다.

## 검증과 완료 조건

기본 여섯 검사, 두 앱 build, 기존 격리 Compose PostgreSQL runner와 실제 Auth.js/Playwright
admin smoke를 실행한다. 단위 검증은 동시 예약, 성공의 부분 환급, TTL/늦은 성공/상한 및
예상 실패 관측 분류를 다룬다. 실제 요청으로 Action으로 소모한 제한이 직접 callback에도
적용되는지, 세션 미발급, Origin/CSRF 거절, 정상 로그인/로그아웃과 기존 관리 CRUD를 확인한다.
테스트의 OTP는 기존 사전 등록 fixture와 요청 전송에서만 다루고 운영 seed/테스트 우회는 추가하지 않는다.

한 PR은 인증 요청 경계의 C2 checkpoint다. 모든 mutation의 적용과 기존 회귀 fixture 변경을
함께 검증해야 한다. 20개/400줄 목표를 넘으면 최종 diff 기준으로 결합 이유와 리뷰 순서를 설명한다.
실행 결과와 실제 source/검사/보류는 별도 RESULT에 기록하고, 한글 커밋 → push → PR 생성으로 끝낸다.
새 C2 PR 병합과 D 착수는 포함하지 않는다.
