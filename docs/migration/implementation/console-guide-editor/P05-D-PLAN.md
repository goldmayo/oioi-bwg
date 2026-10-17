---
title: "P05-D 제한된 MFA 등록과 OTP 로그인 계획"
kind: migration-plan
status: active
authority: plan
source_commit: e9070245f073b5ce39b96b90ad5e22ff8913f307
created_at: "2026-10-10"
---

# P05-D 실행 계획

사용자 재검토 승인과 [#126 Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/38042786002)
전체 성공을 확인해 #126을 squash 병합하고 fetch한 위 merge head에서 분기했다.
local migration_main은 `9829b1b`였으므로 분기 기준으로 사용하지 않았다. 사용자 변경은 없었다.
상위 기준은 [헌법](../../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
[Auth §4.1](../../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
[API](../../oioi-bwg-architecture-clean-v1/03-api-error-architecture.md),
[Server](../../oioi-bwg-architecture-clean-v1/06-server-data-access-architecture.md),
[Form](../../oioi-bwg-architecture-clean-v1/08-form-state-architecture.md),
[Testing](../../oioi-bwg-architecture-clean-v1/10-testing-architecture.md),
[Domain AUTH-009](../../DOMAIN_SPECIFICATION.md#auth-009-console-mfa-등록과-회수),
[P05 설계 §4·8](P05-DESIGN.md), [C2 결과](P05-C2-RESULT.md)다.

## 확정과 구현 범위

- `CONSOLE_MFA_ENROLLMENT_ENABLED=true`일 때만 등록을 연다. 기본/다른 값은 닫힘이다.
  loopback 비공개 실행 계약을 유지하며 이 설정은 password-only 인증을 허용하지 않는다.
- setup/confirm은 configured Origin과 JSON/Zod 입력, C2의 공유 limiter를 거쳐 B2 core를 호출한다.
  매번 비밀번호와 ACTIVE ADMIN을 확인한다. setup은 저장된 pending secret/version의 QR을 반환하며
  confirm은 version/OTP를 비교하고 최초 step을 소모한다. 두 endpoint 모두 세션을 발급하지 않는다.
- qrcode의 서버 PNG 생성 API를 사용하고 요청/응답을 serializable contract로 제한한다.
  모든 등록 응답에 no-store, 제한에는 OTP_RATE_LIMITED/429/양의 Retry-After를 적용한다.
  예상 인증 실패는 동일한 공개 메시지로 번역하고 원본 입력/QR/secret을 관측 도구에 보내지 않는다.
- 로그인 첫 단계는 RHF 입력만 검사하고 다음 단계에서 OTP와 함께 기존 Auth.js Action을 호출한다.
  등록 완료는 QR·비밀번호·OTP를 버리고 다음 코드 및 비밀번호 재입력을 안내한다.
  취소/페이지 이탈도 폐기한다. 직접 callback의 rate_limited와 Action/HTTP 대기 안내를 표시한다.
- 등록은 일회성 인증 입력/QR이므로 Query/mutation cache에 넣지 않고 기존 ky transport와
  RHF/local state로 처리한다. 이는 서버 콘텐츠 상태의 Query 획득 흐름을 변경하지 않는다.
- DB schema/core/CLI, 새 grant/세션 DB, recovery UI, 공개 배포/HTTPS/Web Admin 제거는 변경하지 않는다.

## 검증과 완료

기본 여섯 검사와 두 앱 build, 기존 Compose PostgreSQL suite와 격리 admin runner를 실행한다.
실제 PNG를 QR decoder로 읽어 동시 setup의 secret/version이 저장값에 수렴하는지 확인한다.
관리 권한 없이 등록 → 최초 코드 확인 → 같은 코드 로그인 거절 → 다음 코드로 실제 UI 로그인,
reset 후 과거 QR/version/JWT 거절과 재등록, 등록 닫힘/Origin/비ADMIN/정지/실패 제한을 검증한다.
기존 C1/C2 및 두 앱 관리/편집 smoke도 보존한다. QR이 없는 화면만 스크린샷으로 남긴다.
운영 seed/production credential과 실제 물리 인증기 검증은 사용하지 않는다.

등록부터 OTP 로그인까지 하나의 checkpoint로 검증한다. 최종 PR에서 20파일/400줄 목표 초과 시
실제 diff와 결합 이유·리뷰 순서를 명시한다. RESULT에 실제 실행 source/결과/보류를 기록하고
한글 커밋 → push → migration_main 대상 PR로 완료한다. 새 PR 병합과 P06 착수는 포함하지 않는다.
