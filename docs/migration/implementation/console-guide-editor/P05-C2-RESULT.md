---
title: "P05-C2 로그인 제한과 Origin/CSRF 결과"
kind: migration-result
status: completed
source_commit: 8aff1ae7d0c5195bdceb9dc5bad74c21f4fe9f4c
created_at: "2026-10-10"
---

# P05-C2 결과

[계획](P05-C2-PLAN.md)의 구현·검증 source는 위 커밋이다. 사용자 C1 승인과
[PR #125 Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/38029030507) 필수 검사 성공 후
#125를 squash 병합한 `4313eec`를 fetch해 분기했다. 최초 사용자 변경은 없었다.
[PR #126](https://github.com/goldmayo/oioi-bwg/pull/126)을 `migration_main` 대상으로 생성했다.
최초 결과 기록 시점에는 새 PR을 병합하지 않았으며 CI 전체 성공을 확인하지 못했다.

## 구현과 보장 범위

`rate-limiter-flexible@11.2.1`을 고정하고 실제 설치 소스의 consume/reward/TTL 동작을 확인했다.
[공식 구현](https://github.com/animir/node-rate-limiter-flexible/blob/master/lib/RateLimiterMemory.js)과
[Auth.js 오류 계약](https://authjs.dev/reference/core/errors#credentialssignin)을 대조했다.
최종 authorize는 Zod 다음에 계정별 5회/5분·공통 IP 20회/5분을 예약한 뒤 B2 인증을 호출한다.
계정 key는 trim/lowercase와 SHA-256을 적용한다. 신뢰 proxy 계약이 없는 P05에서는 XFF/X-Real-IP를
읽지 않고 unknown IP bucket을 쓴다. 계정 key 상한은 1,024개다. TTL이 지난 metadata는 다음 요청에서
정리하고 라이브러리 counter는 TTL timer로 제거한다. 상한 도달 시 새 계정은 제한을 생략하지 않는다.

프로세스 singleton은 Next의 route/Action bundle에서도 같은 counter와 라이브러리 오류 constructor를
쓴다. 거절된 초과 예약은 환급하고, 인증 실패/내부 오류는 예약을 유지한다. 성공은 자신의 예약만
한 번 환급하며 다른 실패를 지우지 않는다. 만료/교체된 window의 늦은 성공은 새 counter를 줄이지 않는다.
앱 Auth adapter만 예상 제한을 `LoginRateLimited`로 바꾸며 일반 AppError/내부 오류를 변환하지 않는다.
Action은 RATE_LIMITED/양의 정수 대기 시간을, callback은 표준 code=rate_limited redirect를 반환한다.
둘 다 별도 HTTP 429를 약속하지 않는다. 정상 CredentialsSignin/예상 제한의 AUTH_FAILURE 제외를 유지했다.
FSD feature Action은 기존 public API에서 FormData를 전달하며 header/오류 처리는 앱 Auth adapter가 소유한다.

Auth.js 모든 POST, 로그인/로그아웃/업로드 Action, 관리 JSON mutation 및 두 DELETE 경계에서
configured Origin을 정확히 비교한다. JSON은 application/json만 허용한다. Auth.js CSRF와
[Next Action Origin/Host 검사](https://nextjs.org/docs/app/guides/data-security#allowed-origins-advanced)를
유지한다. GET signout은 실제 로그아웃을 하지 않는다. Route 거절은 403이며 외부/null Action은
Next가 먼저 차단할 수 있어 Action의 HTTP 403을 약속하지 않는다.

## 직접 실행한 검증

- 기본 여섯 검사 모두 통과: `pnpm type-check`, `pnpm test:harness`(18건), `pnpm lint`,
  `pnpm lint:fsd`, `pnpm test:unit:run`(445건), `pnpm format:check`.
  Console 184건은 새로 실행해 통과했으며 최종 unit/lint workspace task는 4개 모두 cache였다.
  최종 type-check는 Console 재실행/다른 세 workspace cache와 repo 검사를 통과했다.
- `pnpm test:ops` 54/54, `pnpm test:integration:postgres:local` 33/33 통과.
- Compose loopback DATABASE_URL과 SENTRY_SOURCE_MAPS_ENABLED=false를 명시한
  `pnpm build --env-mode=loose --force`: 두 앱 cache 없이 통과. runtime MFA key 없이 컴파일했다.
- `pnpm test:integration:admin:local`: 실제 Auth.js/PostgreSQL/Playwright/CLI 통합 통과.
  실제 폼의 Flight payload를 관찰한 뒤 OTP 필드만 보완한 Action 로그인 → 보호 API 200,
  Action 실패 5회 → 제한 code/대기 시간 → 같은 계정의 직접 callback 제한 및 세션 미발급을 확인했다.
  동시 callback 6건은 일반 Credentials 거부 5건/제한 1건이며 모두 세션이 없다.
  계정과 XFF/X-Real-IP를 바꿔도 공통 IP 제한을 우회하지 못했다. 제한 전후 AUTH_FAILURE 증가도 0이다.
- 유효 JWT/CSRF로 모든 관리 mutation/Auth POST의 누락/null/Web/외부 Origin을 시도해 403을 확인했다.
  세 Action의 Origin 거절, 같은 Origin 업로드의 파일 검증 도달, JSON content-type 거절,
  잘못된 CSRF/GET의 로그아웃 미실행과 정상 HTTP/실제 UI Action 로그아웃을 확인했다. R2는 호출하지 않았다.
- 포화된 Console 프로세스를 종료하고 새 프로세스에서 C1 회귀를 독립 실행했다. 두 실행의 로그를
  보존해 검사했다. JWT proof/만료/client update/OTP replay/CLI reset·강등·정지·복귀,
  편집 401의 초안 보존·재로그인 후 저장, 두 앱 CRUD/세션 격리 모두 통과했다.
  두 runner의 잔여 connection/advisory lock은 0이며 임시 DB/role 정리가 완료됐다.
- 세 smoke 파일의 `node --check`와 기존 MFA fixture의 Bundler 방식 별도 TypeScript 검사도 통과했다.
  초기 타입/ESLint/단위 실패를 보완했다. 초기 smoke의 CSRF redirect·절대 Action redirect 가정과
  Flight multipart 순서 오류를 설치 코드/실제 요청에 맞춰 수정한 뒤 최종 전체 통과했다.
  plain object의 숫자 key 0이 앞에 전송돼 입력 검증에서 끝나던 시도는 limiter 검증으로 집계하지 않는다.

## 보류와 후속

D의 등록 API/QR/OTP 폼·서버 대기 시간 표시/직접 callback code 안내는 아직 구현하지 않았다.
현재 일반 password-only 폼으로는 Console에 로그인할 수 없는 중간 상태이며 공개하지 않는다.
D setup/confirm은 같은 예약 함수와 Origin helper를 사용하고 HTTP 429/Retry-After를 연결해야 한다.
process 재시작은 counter를 지운다. 신뢰 proxy IP·복수 process/분산 제한·HTTPS/Secure cookie·공개 배포,
실제 R2/image smoke·Web Admin 제거는 P06이다. Web 전체 Session 회수와 DB 권한 세분화의 기존 보류를
완료로 주장하지 않는다. production DB/credential 및 운영 seed 사용은 없었다. C2 PR 병합/D 착수는 보류한다.

자동 hook은 직접 실행 검사와 구분한다. 코드 커밋의 pre-commit eslint/prettier는 통과했다.
문서 커밋은 lint-staged 대상이 없었다. 최초 push의 pre-push는
`turbo run type-check lint test --affected`의 Console 3개 task를 모두 cache로 통과했다.
이어 `pnpm type-check:repo`, `pnpm lint:repo`, `pnpm test:harness`(18건),
`pnpm test:ops`(54건), `pnpm format:check`도 모두 통과했다.
이 문서의 PR/hook 기록 보완 push에서 자동 재실행되는 검사는 최종 PR 본문/보고에서 구분한다.

## PR #126 리뷰 후 CI 산출물 경로 수정

수정 source는 `7e00d383976dba87a97bb433298830f6b5b23430`이다. 리뷰 당시 head `a064529`의
[Verify](https://github.com/goldmayo/oioi-bwg/actions/runs/38037372855)는 Admin 통합 초기화의
manifest ENOENT로 실패했다. 위 로컬 빌드 검증은 CI 복원 구조까지 검증한 결과가 아니었다.
동일 브랜치에서 수정했으며 시작 시 사용자 변경은 없었다.

실패 run의 `ci-standalone` 아카이브를 내려받아 `tar -tzf`로 manifest가
`apps/console/.next/standalone/apps/console/.next/server/server-reference-manifest.json`에
포함됨을 확인했다. smoke는 이 standalone 디렉터리 상수를 기준으로 읽도록 수정했다.
일반 `.next/server`를 추가로 패키징하거나 앱 인증 코드/빌드 설정을 바꿀 필요는 없었다.

- 직접 실행한 기본 여섯 검사 모두 통과했다. harness 18건, unit 445건이며
  type-check/lint/unit의 네 workspace task는 모두 cache였고 repo 검사도 통과했다.
  최초 format 실패는 해당 파일에 Prettier를 적용한 뒤 재실행해 통과했다.
  `node --check tests/ops/console-auth-ingress-smoke.mjs`와 `git diff --check`도 통과했다.
- 내려받은 amd64 아카이브를 arm64 환경에서 실행한 첫 시도는 Argon2 native build 불일치로
  중단됐다. 이는 통과로 집계하지 않으며 임시 DB/role 정리와 기존 빌드 복원을 완료했다.
- 기존 로컬 빌드를 Dockerfile과 동일한 standalone/static 경로만 아카이브한 뒤 복원했다.
  두 앱 모두 일반 `.next/server`가 없는 상태에서 기존 경로의 ENOENT와 수정 후 import 성공을
  확인하고 `pnpm test:integration:admin:local` 전체를 실행해 통과했다. 실제 C2 인증 경계,
  C1 세션 회수 및 두 앱 관리 흐름을 검증했으며 잔여 connection/advisory lock은 0이다.
  증거는 `/tmp/oioi-p04-smoke-hQPi0m`이며 기존 로컬 빌드를 복원했다.
- 앱 runtime/build 변경이 없어 새 build와 독립 PostgreSQL suite는 재실행하지 않았다.
  production DB/credential 사용은 없었다. 수정 커밋의 pre-commit ESLint/Prettier는 통과했다.

후속 push의 pre-push 결과와 최신 head Verify 상태는 PR 본문/완료 보고에 별도로 기록한다.
PR 병합과 P05-D 착수, P06 공개 전 제한 재설계 등 기존 보류 범위는 유지한다.
