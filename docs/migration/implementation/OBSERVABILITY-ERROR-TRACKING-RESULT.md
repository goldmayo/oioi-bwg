---
title: "오류 원인과 처리 결과 추적 개선 결과"
document_id: "OBSERVABILITY-ERROR-TRACKING-RESULT"
version: "1.2"
status: "active"
authority: "result"
updated_at: "2026-10-22"
depends_on:
  - "OBSERVABILITY-ERROR-TRACKING-PLAN"
  - "03"
  - "09"
---

# 오류 원인과 처리 결과 추적 개선 결과

## 1. 기준과 완료 범위

계획은 [PR #195](https://github.com/goldmayo/oioi-bwg/pull/195)의
[v1.1 고정본](https://github.com/goldmayo/oioi-bwg/blob/dd2b41f1e03a2e29d43f98badabb283d0c595986/docs/migration/implementation/OBSERVABILITY-ERROR-TRACKING-PLAN.md)이다.
계획 branch에만 있는 문서를 이 branch에 복제하지 않는다. 기존 9월 audit·결과는 역사 기록으로 유지한다.

`origin/migration_main`과 실제 원격이 일치한 `4d5e42dac37aeb13b3279b47a7907fbb7bc91be2`에서
`feature/observability-p1-a-error-classification`을 분기했다. 모노레포 정리 branch의 미병합 변경은 포함하지 않았다.
03 v1.5·09 v1.4에서 정상 처리된 AppError와 탈출한 delivery 실패를 구분하고 index v1.28을 동기화했다.
헌법·도메인 code·HTTP status·인증 판정은 그대로다.

- [x] P1-A: Console server 오류 분류와 최종 정제, 대응 규범·회귀 검사
- [ ] P1-B: Console RSC 인증 전달과 실제 로그인/거부 UX 검증
- [ ] P2-A: Console app·경로 template·operation·breadcrumb
- [ ] P2-B: Web의 실제 consumer 적용
- [ ] P3: 기존 인증 판정 기반 typed rejection log
- [ ] P4-A: Console 서버 생성 request ID와 두 sink 연결
- [ ] P4-B: Web dynamic/API 요청 연결
- [ ] 계획 §11: 기존 Slack 규칙 보완과 이미지별 소스맵 운영 검증

## 2. P1-A 구현

실제 AppError instance와 contract enum code가 확인되면 `error.type=application`을 사용한다.
Next render 오류 hook의 `next.request_error`는 `handling=unhandled`, `outcome=render_error_captured`다.
이 경계의 application 오류는 `failure.kind=delivery`로 기록하며 caller의 handled 표기로 버리지 않는다.
output contract는 contract, 확인된 DB/Auth 장애는 system, 근거가 부족한 오류는 unknown이다.

명시적으로 처리한 AppError는 JSON error/Sentry sink에서 제외한다. 기존 HTTP adapter도 정상
401/403/404/409를 그대로 반환하며 reporter를 부르지 않는다. 인증 decision의 info log는 P3 범위다.
logger와 Sentry reporter는 서로 의존하지 않으며 같은 작은 분류 함수를 사용한다.

producer의 code·분류·관측 결과가 beforeSend 최종 allowlist에 남는다. 새 enum도 재검증하고 잘못된
application code와 arbitrary classification은 unknown으로 정규화한다. 실제 render hook 정보가 없으면
HTTP 500·브라우저 오류 화면·로그인 이동을 추정하지 않는다. 나머지 outcome vocabulary는 후속 consumer용이다.

SDK에는 원본 Error identity를 전달한다. 최종 event의 DeliveryError 표시는 고정 문구이며 기존 frame·release·
Debug ID 정제를 유지한다. raw message·SQL·개인정보·임의 cause를 metadata로 복구하지 않는다.
React가 원래 타입/code를 보존하지 않은 Error는 unknown으로 수집한다. 기존 A/B 이슈 해결을 뜻하지 않는다.

## 3. 실제 로컬 검증

| 명령/비교 | 결과 |
| --- | --- |
| Console `vitest run src/server/observability/server-logger.test.ts src/server/http/api-response.test.ts` | 변경 전 2파일·18건, 변경 후 2파일·32건 성공 |
| `pnpm exec turbo run type-check lint test --concurrency=4` | 최종 12 task 성공, 9개 캐시. unit 81파일·424건: contracts 3 + server 88 + Web 93 + Console 240 |
| `pnpm type-check:repo`, `pnpm lint:repo` | 성공 |
| workspace lint가 실행한 양쪽 `lint:fsd` | 성공 |
| `pnpm test:harness` | 18건 성공. 모노레포 branch의 추가 harness는 이 기준선에 없음 |
| `pnpm test:ops` | 21파일·262건 성공 |
| `pnpm build --force --env-mode=loose` | 변경 전후 두 앱 모두 컴파일·타입 검사·정적 생성·standalone 구성 성공. 각 2 task·Turbo 캐시 0개 |
| build 출력의 route·정적/동적 표기 대조 | Web 21개·Console 18개가 변경 전후 동일 |
| `pnpm format:check`, `git diff --check` | 성공 |

최초 workspace 검사에서는 새 test event의 필수 `type` 누락을 발견해 fixture를 수정했다.
긴 test group의 lint 경고는 group 분리로 제거했다. 이후 오류 이름 선택도 고정 table로 단순화하고
workspace 검사를 다시 통과했다. 검사 억제·강제 cast·hook 생략으로 해결하지 않았다.
첫 commit은 본문 한 줄의 100자 제한으로 거절되어 메시지의 줄바꿈을 보완했다.

새 회귀는 정상 401/403/404/409 제외, 탈출한 인증 오류의 두 sink/final payload, 잘못된 enum·hostile getter,
원본 Error identity와 frame fixture, SQL/email/OTP/token marker 제거를 확인한다. 실제 instrumentation hook도
Sentry OFF에서 JSON 분류를 유지했다. Sentry SDK mock 검증이며 원격 수신이나 실제 심볼리케이션 검증은 아니다.

build는 source map upload와 Sentry 전송을 끄고 local 환경, loopback origin, 임시 Console secret,
`127.0.0.1:1`의 접근 불가 DB URL을 명령 입력으로 사용했다. 개인 env·MFA key·DB volume은 건드리지 않았다.
실행 로그는 작업 worktree의 `.local/observability/p1-a/`에 있다.

검증한 소스는 위 기준 SHA와 이 RESULT를 포함한 커밋의 diff다. Console 파일별 Git blob은 다음과 같다.

| `apps/console/src/` 아래 파일 | 검증 blob |
| --- | --- |
| `server/observability/safe-server-event.ts` | `321861b443647d52305879a2a316ac527adbd153` |
| `server/observability/server-logger.ts` | `0251678868b75bdb1a493ddf130656be0375773e` |
| `server/observability/server-sentry-reporter.ts` | `f0bebb7cb8021762ac476d92518cd80d74806a10` |
| `server/observability/server-logger.test.ts` | `d308c1b7a4ca24fa812b6eb51e36a181245fe543` |
| `server/http/api-response.test.ts` | `02c0c481452551d12630fa8c3bd08b89ef089813` |

## 4. 한계와 다음 단위

정상 인증 거부의 직접 진입/navigation/revocation UX는 P1-B에서 별도로 구현·Playwright 검증한다.
이번에는 실제 앱 DB 조회/CRUD·관리자 E2E·standalone browser smoke를 실행하지 않았다.
Sentry/Slack 현재 설정 조회·이벤트 전송·알림 규칙 변경·OCI/Vault/운영 DB 변경·배포도 하지 않았다.

총 diff의 400줄 목표 초과는 같은 계약의 규범, producer 두 sink, 최종 sanitizer, privacy 회귀를 함께
검토하기 위한 것이다. 리뷰 순서는 03/09 → 분류 함수 → logger/reporter → HTTP·privacy test → 이 결과다.
인증 adapter·Web 확장·Proxy·외부 알림·배포 gate는 섞지 않았다. 사용자 지시에 따라 새 PR 생성은 보류한다.

## 5. Console RSC 인증 전달 — P1-B 첫 단위

계획 §3.3·§7·§8의 RSC adapter와 실제 인증 UX를 먼저 분리했다. 최신 `migration_main`은 여전히
`4d5e42dac37aeb13b3279b47a7907fbb7bc91be2`였다. 이 ref에서
`feature/observability-console-rsc-auth`를 만들고 미병합 선행 P1-A
`56c250676c8af3c2e39712f9e390f2f47e3d60f2`를 fast-forward로 포함했다. 기존 커밋은 보존했고
upstream을 `migration_main`으로 두지 않았다. 이번 변경의 검토 기준은 `56c2506..HEAD`다.
모노레포 정리·Slack Worker 디자인 변경은 포함하지 않았다. §1~4는 P1-A 당시의 기록으로 보존한다.

- [x] P1-B 첫 단위: 각 관리자 RSC의 인증 선행 확인·알려진 인증 오류 번역·실제 로그인/회수 UX
- [ ] P1-B 후속: browser boundary outcome·수집 중복 처리, 의도적으로 주입한 장애의 실제 runtime 수집

따라서 §1의 P1-B 전체 완료 표시는 아직 변경하지 않는다. 신규 관측 필드를 이번 인증 처리에 섞지 않았다.

### 구현과 리팩토링 점검

- Console `server/auth/admin-page-context.ts`가 기존 request-cached context를 읽는다. guest는
  `/admin-login`, 인증된 context의 `manage all` 거부는 기존 `forbidden()`으로 번역한다.
  layout뿐 아니라 albums·songs·edit page도 service 호출 전에 같은 검사를 한다.
- 각 page의 service Promise에서 실제 `AppError`의 UNAUTHENTICATED/FORBIDDEN만 번역한다.
  다른 AppError·unknown·Next 제어 예외는 원본 그대로 다시 던진다. edit의 기존 not-found는 유지한다.
  songs의 병렬 조회·Query hydration·DTO·서비스의 실제 보안 검사는 유지한다.
- 기존 `getRequestContext()`·Auth.js·MFA·CASL·서비스·HTTP adapter·instrumentation·sanitizer는
  변경하지 않았다. 새 DB 조회·process-global 인증 cache·범용 route wrapper·dependency는 없다.
- [Next 인증 지침](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks)과
  [redirect 제어 예외](https://nextjs.org/docs/app/api-reference/functions/redirect)를 확인했다.
  기존 `authInterrupts`/`forbidden()` 설정은 유지했고 설치된 Next 16.4.1 standalone으로 확인했다.

### 이번 단위에서 실행한 검증

| 명령/범위 | 실제 결과 |
| --- | --- |
| 추가 Vitest 두 파일 | 27건 성공. guest/권한 부족의 service 미호출, 서비스 인증 오류 번역, 원본 예외·not-found 보존 |
| `pnpm exec turbo run type-check lint test --concurrency=4` | 12 task 성공·9개 캐시. unit 83파일·451건: contracts 3 + server 88 + Web 93 + Console 267 |
| `pnpm type-check:repo`, `pnpm lint:repo` | 성공. smoke 수정 뒤 repo lint도 다시 성공 |
| `pnpm test:harness`, `pnpm lint:fsd` | harness 18건·두 앱 FSD 성공. workspace/build와 harness를 겹쳐 실행하지 않음 |
| `pnpm test:ops` | 기준선의 21파일·262건 성공. 새 browser smoke는 이 unit 명령과 별도 |
| `pnpm build --force --env-mode=loose` | 두 앱 컴파일·타입 검사·정적 생성·standalone 구성 성공. 2 task·캐시 0개 |
| `tsx scripts/run-postgres-integration-tests.ts --local --admin-smoke` | 실제 standalone·Playwright·PostgreSQL 관리자 전체 흐름 성공 |
| `pnpm format:check`, `git diff --check` | 성공 |

최초 focused 검사는 auth barrel의 실제 Auth.js 로딩으로 실패해, 이 adapter unit의 관심사가 아닌
auth UI/barrel만 mock으로 격리했다. 최초 workspace type-check는 목록 fixture의 DTO 형태 오류를 찾아
`{ items, nextCursor }`로 고친 뒤 다시 성공했다. 검사 억제·강제 cast·hook 생략으로 해결하지 않았다.

기존 Compose PostgreSQL 17이 healthy임을 먼저 확인했다. 기존 runner의 임시 DB·역할과 MFA fixture만
사용했고 개인 DB 복원·임의 seed 추가는 하지 않았다. 새 browser 검사는 세 경로의 비로그인 직접 진입,
만료 JWT, 실제 권한 회수 뒤 sidebar Link 이동, 권한 복구 후 기존 JWT의 계속된 거부, 새 로그인 성공을
확인했다. 이 구간의 `next.request_error`는 0건이었다. 기존 전체 관리자 CRUD·가사 편집/재인증·회수·
Web 인증 제거/공개 조회 검사와 민감 fixture 값의 로그 부재도 성공했다. 종료 시 연결 0개·advisory lock
0개를 확인하고 임시 DB·역할을 정리했다. 기존 ingress의 의도적인 Action 거부 로그와 구분한다.

검증한 helper blob은 `1ee6b58853d4ec2fae9ae82e19d43135889cc639`, consumer test는
`68683bd823521533bbbabdb10bddf37fc083db73`, MFA smoke는
`68465c3d34e0e2d1973a844e82c10ad6f995debb`다. 나머지 변경과 이 결과를 포함한 커밋이 검증 범위다.
로그·browser artifact는 이 worktree의 `.local/observability/console-rsc-auth/`에 보존한다.

### 한계와 배포 대기

앱 build는 Sentry/소스맵 업로드를 끈 local 입력과 접근 불가능한 loopback DB URL을 사용했다.
browser 검증도 외부 Sentry 전송을 끈 실제 로컬 격리 DB에서 실행했다. 원격 수신·실제 소스맵 복원이나
현재 운영 이슈 해결을 확인한 결과는 아니다. 인증된 context/service의 403 번역은 unit으로 검사했고,
실제 Console의 권한 회수는 AUTH-009에 따라 guest/로그인 이동이므로 이를 실제 403 검증으로 쓰지 않는다.

개인 env·DB volume·MFA key와 운영 DB·VM·Vault·secret을 변경하지 않았다. 새 PR·병합·배포·외부 알림은
보류한다. **Sentry 알림 디자인은 미배포**이며 사용자 배포·새 형식 수신 확인 전까지 후속 브리핑에 표시한다.
배포 절차/대기 체크리스트는
[Slack relay 결과 §10](https://github.com/goldmayo/oioi-bwg/blob/0ab0923c5dbb59405cd18fc8cc7ef5cc065d3bc8/docs/migration/implementation/SENTRY-SLACK-RELAY-RESULT.md#10-2026-10-22-사용자-수동-배포-대기)을 따른다.

## 6. Console 브라우저 오류 화면 관측과 중복 처리 — P1-B 두 번째 단위

기준은 `feature/observability-console-rsc-auth`의 깨끗한
`a5539af85f90d0898550278bfb760f7f62559562`다. 실제 원격도 같은 SHA였고 `origin/migration_main`은
`4d5e42dac37aeb13b3279b47a7907fbb7bc91be2`였다. 기본 checkout의 모노레포 작업은 보존했다.
§1~5는 당시 기록이며, 이번 실행 결과는 이 절이 소유한다. 승인 계획 고정본은 §1을 따른다.

- [x] 두 오류 화면의 mount outcome·관측별 중복 처리·최종 정제와 로컬 회귀
- [ ] P1-B 남은 범위: 실제 Next 요청의 DB/service/render 장애 주입과 서버·browser 수집 검증

따라서 P1-B 전체는 계속 미완료다. 원격 수신·배포·운영 이슈 해결도 완료 처리하지 않는다.

### 구현과 리팩토링 점검

- Admin/global 오류 화면의 `useEffect`에서만 `error_boundary_mounted`를 생성한다. producer와
  최종 beforeSend가 같은 작은 정제 함수를 사용하며, 다른 source·없는/잘못된 outcome은 unknown이다.
- WeakMap은 Error 객체별 source/outcome 조합만 기억한다. Query/Mutation 선행 보고 뒤 boundary의
  최초 관측은 별도 event이며, 동일 관측의 StrictMode·재렌더는 억제한다. digest·시간창으로 합치지 않는다.
- 설치된 Sentry 10.42.0의 객체 중복 제거와 기본 Dedupe는 이 관측을 잃게 할 수 있었다.
  원본 Error를 `client.eventFromException()`에 전달하고, 복제한 scope의 `captureEvent()`로 보낸다.
  `originalException` hint를 다시 붙이지 않으며, Promise 실패는 null로 끝내 복구 화면을 보호한다.
- Console의 기본 Dedupe만 제외했다. 서로 다른 Error를 같은 stack/message로 합치지 않고,
  자동 capture의 SDK 객체 중복 제거는 유지한다. 명시적 보고의 중복은 위 WeakMap이 소유한다.
- 기존 event를 나중에 갱신하거나 server/browser를 병합하지 않는다. 각 event는 관측 기록이며 요청별
  장애 건수로 단순 합산하지 않는다. 원본 frame·release·Debug ID 정제와 unknown 수집은 유지한다.
- 새 dependency·route·전역 request/user context·범용 wrapper는 없다. 서버 인증·reporter와 Web은
  이번 단위에서 변경하지 않았다. 요청 ID·경로/breadcrumb·인증 사유·운영 알림은 후속 범위다.

SDK 판단 근거는 설치 소스와 공식 [client](https://github.com/getsentry/sentry-javascript/blob/10.42.0/packages/core/src/client.ts)·
[Dedupe](https://github.com/getsentry/sentry-javascript/blob/10.42.0/packages/core/src/integrations/dedupe.ts) 고정본이다.
09 §12·18의 관측 의미 안에서 구현했으며 규범과 과거 계획을 개정하지 않았다.

### 이번 단위에서 실제 실행한 검증

| 명령/범위 | 실제 결과 |
| --- | --- |
| `pnpm exec turbo run type-check lint test --concurrency=4` | 최종 12 task 성공·9개 캐시. unit 86파일·464건: contracts 3 + server 88 + Web 93 + Console 280 |
| `pnpm type-check:repo`, `pnpm lint:repo` | 성공 |
| `pnpm test:harness`, `pnpm lint:fsd` | harness 18건·두 앱 FSD 성공. harness는 workspace/build와 겹치지 않음 |
| `pnpm test:ops` | 21파일·262건 성공 |
| `pnpm format:check`, `git diff --check` | 성공 |
| `pnpm build --force --env-mode=loose` | Next 16.4.1 두 앱 컴파일·타입 검사·정적 생성·standalone 구성 성공. 2 task·캐시 0개 |
| `node .local/observability/browser-boundary/browser-check.mjs` | 실제 Chromium·React 19.2.5·Browser SDK 10.42.0의 5개 envelope를 로컬에서 가로채 검증 |

최초 RTL은 window 없는 document fixture로 실패해 iframe document로 고쳤다. workspace가 찾은
테스트 타입 오류는 올바른 getter/비동기 반환 타입·query option으로 수정했다. lint import 정렬과
test group 길이·타입 전용 상수 경고도 정리했다. 검사 억제나 강제 cast로 우회하지 않았다.

Chromium 검사는 실제 Console 두 component·Query client·instrumentation policy를 별도 bundle로 실행했다.
SDK import는 같은 버전의 `@sentry/browser`로 연결해 Next bridge를 제외했다. Query와 SDK 자동 보고를
먼저 수행하고 실제 mount·반복 render·같은 digest/stack의 별개 Error를 확인했다. 합성 frame·release·
Debug ID fixture 보존과 token/email/cookie/MFA/SQL marker 부재를 최종 envelope에서 검사했다.
모든 네트워크 요청을 intercept했으며 실제 Sentry/Slack으로 보내지 않았다. 일반 CI/hook 범위는 그대로다.

build는 Sentry/소스맵 업로드 OFF·local 환경·빈 DSN·임시 Console secret·loopback origin·
`127.0.0.1:1`의 접근 불가 DB URL을 사용했다. 개인 env·DB volume·MFA 키·운영 자원은 변경하지 않았다.
이번에는 DB/전체 관리자 smoke·Next 요청의 실제 장애·원격 수신·실제 소스맵 복원을 검증하지 않았다.

검증 소스는 위 기준 SHA부터 이 결과를 포함한 커밋까지의 diff다. 주요 blob은 capture helper
`2ade5fe5eec9bbb39c5776e211dac05cb422984c`, client reporter `913c41d18dde56ba1800bfb81fca989e016cd00d`,
policy `5dd64d5a605798801a9231f080d8aa9416bc8774`다. 실행 로그·브라우저 fixture/envelope는
이 worktree의 ignored `.local/observability/browser-boundary/`에 보존하며 원격에 push하는 파일은 아니다.

새 PR·병합·배포는 보류한다. **Sentry Slack 알림 디자인은 미배포**이며 §5의 수동 배포 대기를 유지한다.
