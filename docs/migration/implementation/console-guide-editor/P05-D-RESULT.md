---
title: "P05-D 제한된 MFA 등록과 OTP 로그인 결과"
kind: migration-result
status: completed
source_commit: 330f4210a940603a2588ee40008c81ec4642f55c
created_at: "2026-10-10"
---

# P05-D 결과

[계획](P05-D-PLAN.md)의 구현·직접 검증 source는 위 커밋이다. 사용자 #126 재검토 승인과
최신 Verify 전체 성공을 확인해 `e907024`로 squash 병합하고 fetch한 merge head에서 분기했다.
기존 local migration_main은 분기 기준으로 쓰지 않았고 사용자 변경은 없었다.
[PR #127](https://github.com/goldmayo/oioi-bwg/pull/127)을 migration_main 대상으로 생성했다.

## 구현과 보장 범위

등록은 `CONSOLE_MFA_ENROLLMENT_ENABLED=true`에서만 열린다. 기본/다른 값은 닫힘이며
Console의 loopback 비공개 실행 계약을 유지한다. 등록 설정은 로그인 인가를 우회하지 않는다.
setup/confirm HTTP는 Origin/JSON/Zod → 공유 C2 limiter → B2 password/ACTIVE ADMIN/core 순서다.
setup은 실제 저장된 pending secret/version을 qrcode 1.5.4의 서버 PNG로 변환하며 활성 secret을
교체하지 않는다. URI는 SHA-1/6자리/30초와 고정 Console issuer를 사용한다.
[qrcode 공식 API](https://github.com/soldair/node-qrcode#es6es7)를 대조하고 설치 타입/실행을 검증했다.
confirm은 version/OTP를 비교해 최초 step을 소모하고 version만 반환한다. 둘 다 세션을 발급하지 않는다.
성공/실패 등록 응답은 no-store이고 초과는 OTP_RATE_LIMITED/429/양의 Retry-After다.
예상 인증 실패는 동일한 401 계약이며 원본 민감 입력/응답을 Sentry로 전달하지 않는다.

RHF 첫 로그인 단계는 입력만 확인하고 최종 단계에서 OTP를 포함한 기존 Auth.js Action을 호출한다.
등록 완료/취소/페이지 이탈은 QR·비밀번호·OTP를 폐기하고 완료 후 다음 코드와 비밀번호 재입력을
안내한다. 인증 데이터는 Query/mutation cache, URL, local/session storage에 넣지 않는다.
일회성 등록은 기존 ky transport와 폼 메모리만 사용한다. HTTP Retry-After와 Action 대기 시간,
직접 callback의 rate_limited 안내를 표시하며 자동 재전송하지 않는다.
새 DB schema/service/CLI/grant/framework와 Web 인증 변화는 없다.

## 직접 실행한 검증

- 기본 여섯 검사 통과: `pnpm type-check`, `pnpm test:harness`(18건), `pnpm lint`,
  `pnpm lint:fsd`, `pnpm test:unit:run`(449건), `pnpm format:check`.
  전체 unit을 cache 없이 먼저 실행했고 최종 unit/type-check는 Console 재실행/다른 세 workspace
  cache와 repo 검사를 통과했다. 최종 lint는 두 workspace cache와 두 앱 재실행/repo 통과다.
  초기 HTTP 입력 union 타입과 import 정렬 실패를 보완한 뒤 통과했다.
- Compose loopback DATABASE_URL과 SENTRY_SOURCE_MAPS_ENABLED=false를 명시한
  `pnpm build --env-mode=loose --force`: 최종 두 앱 cache 없이 통과.
- `pnpm test:integration:postgres:local`: 실제 PostgreSQL 33/33 통과.
- `pnpm test:integration:admin:local`: 일반 standalone과 CI 동일 standalone/static 아카이브 복원
  구조에서 전체 통과했다. 최종 복원 구조는 두 앱의 일반 `.next/server`가 없었고 runner exit 0이다.
  최종 증거 `/tmp/oioi-p04-smoke-y10cP0`. 실제 PNG를 jsQR 1.4.0/pngjs 7.0.0으로 해독하고
  동시 QR의 secret/version이 DB의 복호화한 pending 값과 같은지 검증했다. 동시 confirm은 1건만 성공했다.
  실제 UI 등록 → 세션 없음 → 사용한 코드 로그인 거절 → 다음 코드 로그인/관리 200,
  CLI reset → 옛 JWT/QR version 거절 → 재등록 → 옛 JWT 계속 401 → 새 로그인 200을 확인했다.
  비ADMIN/정지/계정 없음/잘못된 password, Origin 누락/null/Web/외부, 잘못된 입력/content-type,
  등록 닫힘과 setup/confirm의 429/Retry-After, 취소/페이지 이탈과 storage 미저장도 검증했다.
- 새 Console 프로세스로 C1/C2를 독립 실행하며 두 앱 관리 CRUD/가사 편집/401 초안 보존·재로그인,
  proof/replay/version 회수/세션 격리를 통과했다. 로그의 password/OTP/secret/QR/key 미노출을 확인했다.
  PostgreSQL 두 suite와 최종 admin의 잔여 connection/advisory lock은 0이며 DB/role 정리가 완료됐다.
- smoke 문법 검사와 `git diff --check` 통과. 첫 복원 wrapper는 smoke/DB 정리 뒤 SIGTERM(143)으로
  자동 빌드 복원이 중단돼 백업을 확인했다. runner와 복원 작업을 분리해 exit 0으로 재실행하고
  두 원래 빌드를 수동 복원·확인했다. 이 wrapper 종료를 전체 통과로 집계하지 않는다.
- 초기 화면 캡처 대기와 로컬 한글 폰트를 보완해 [로그인](P05-D-LOGIN.png)/
  [등록 완료](P05-D-ENROLLED.png)를 확보했다. QR/인증 입력은 캡처하지 않았다.

코드 pre-commit의 ESLint/Prettier는 통과했다. 문서 커밋은 lint-staged 대상이 없었다.
최초 push의 pre-push는 `turbo run type-check lint test --affected`의 12개 task를 모두 cache로
통과했다. 이어 `pnpm type-check:repo`, `pnpm lint:repo`, `pnpm test:harness`(18건),
`pnpm test:ops`(54건), `pnpm format:check`도 통과했다. 직접 실행 검사와 구분한다.
이 PR/hook 기록 보완 push의 자동 검사와 최신 CI 상태는 PR/완료 보고에 기록한다.

## 보류와 후속

새 PR 병합과 P06 착수는 하지 않는다. production DB/credential과 운영 seed는 사용하지 않았다.
실물 인증기·등록 허용 설정의 운영 접근 통제, HTTPS/Secure cookie, 신뢰 proxy IP/다중 process 제한,
키 백업/복구·R2·공개 배포·Web Admin 제거는 P06 검증 대상이다. 기존 Web 전체 Session 회수와
DB 권한 세분화 보류를 완료로 주장하지 않는다. P05의 loopback 계약과 단일 process limiter 한계는 유지한다.
