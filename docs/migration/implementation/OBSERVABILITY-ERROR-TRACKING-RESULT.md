---
title: "오류 원인과 처리 결과 추적 개선 결과"
document_id: "OBSERVABILITY-ERROR-TRACKING-RESULT"
version: "1.5"
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
- [x] P1-B: Console RSC 인증 전달과 실제 로그인/거부 UX 검증
- [x] P2-A: Console app·경로 template·operation·breadcrumb
- [x] P2-B: Web의 실제 consumer 적용
- [x] P3: 기존 인증 판정 기반 typed rejection log
- [x] P4-A: Console 서버 생성 request ID와 두 sink 연결
- [x] P4-B: Web dynamic/API 요청 연결
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


## 7. 남은 7개 항목의 고정 실행 범위

2026-10-22 사용자가 기존 7개 항목 완료를 요청했다. 추가 확인에서 **코드·로컬 검증만 진행하고,
7번 운영 알림·실수신·소스맵 운영 검증은 배포 대기**로 확정했다. 새 PR·병합·배포·외부 전송은 하지 않는다.
Slack Worker 디자인의 사용자 수동 배포 대기는 별도이며, 모노레포·환경변수·기능 로드맵 작업을 섞지 않는다.
§1의 기존 계획 항목만 수행하고 새 개선을 추가하지 않는다. 아래 기록의 task/test 수는 검사 수이며 작업 완료 수가 아니다.

- [x] 1번: 실제 Next 장애·오류 화면·로컬 event 수집 검증
- [x] 2번: Console 앱·경로·작업·breadcrumb
- [x] 3번: Web의 같은 관측 정책과 실제 consumer
- [x] 4번: 기존 인증 판정 기반 안전한 거부 사유
- [x] 5번: Console 서버 생성 request ID와 JSON/Sentry 연결
- [x] 6번: Web 기존 dynamic/API request ID 연결
- [ ] 7번: 운영 알림·앱 배포·외부 Sentry/Slack 수신·이미지별 실제 소스맵 복원 — 사용자 지정 배포 대기

위 1~6번의 완료는 이 문서에 기록한 코드·로컬 검증 범위다. 과거 절의 미완료 표시는 당시 상태이며
현재 판정은 이 목록과 §1이 소유한다. 미실행 운영 검증을 로컬 결과로 대체하지 않는다.


### Console 앱·경로·작업 정보와 breadcrumb — 2번 완료

기준 `faccbbd9721b3cf4b5e95e6882356059d2bb5037`부터 이 기록을 포함한 커밋까지다.
Console이 소유한 정적 경로 목록과 구체적인 동적 route 패턴만 고정 template/operation으로 바꾼다.
Next hook, API catch, Auth.js reporter, upload Action, browser reporter의 실제 consumer를 연결했다.
최종 server/client beforeSend에 app/runtime/template/operation이 남고, navigation도 같은 template만 남긴다.
unknown 경로·동적 slug/id·URL query/hash·host를 fallback으로 보내지 않는다. 원본 frame·release·Debug ID는 유지한다.

- 실제 검사: workspace type/lint/unit 성공(87파일·475건; Console 291, Web 93, server 88, contracts 3),
  repo 타입/lint, harness 18건, 두 앱 FSD, ops 21파일·262건, format, diff 검사 성공.
- 두 앱 실제 build 성공(Next 16.4.1, Turbo build 2개·캐시 0). Sentry/업로드 OFF·빈 DSN·local 환경과
  기존 접근 불가 loopback DB/임시 Console 입력을 사용했다. 운영·개인 설정과 DB 데이터는 변경하지 않았다.
- 최초 focused 검사는 새 app/runtime/route가 기존 정확 일치 fixture에 추가돼 실패했다.
  예상 payload를 새 계약으로 갱신했고 검사 억제 없이 전체 검사를 통과했다.
- producer·최종 정제·privacy 회귀와 각 HTTP/Action consumer를 함께 검토해 20파일 목표를 넘었다.
  공용 package·범용 wrapper·서버 사용자 상태 cache를 추가하지 않았다.
- 로그: ignored `.local/observability/finish/console-metadata/`. remote 수신·배포 검증 결과가 아니다.


### Web의 같은 관측 정책과 실제 consumer — 3번 완료

기준 `5785f7f2fd1b1224c595dcc163ae3ef3a6c8177e`부터 이 기록을 포함한 커밋까지다.
공개 Web의 server/client 분류·outcome·원본 frame 보존과 boundary 관측별 중복 처리를 Console과 맞췄다.
Web 소유 route 목록만 template/operation으로 바꾸고 두 공개 API catch와 Next hook, global 오류 화면을 연결했다.
최종 beforeSend의 app은 web으로 고정하고 breadcrumb의 동적 값도 제거한다. Web 인증/UI/API는 복구하지 않았다.
Next hook은 두 앱 모두 정제한 template만 reporter로 전달하도록 확인했다. unknown 경로와 health/auth 경로는 생략한다.

- 실제 검사: workspace type/lint/unit 성공(89파일·509건; Web 127, Console 291, server 88, contracts 3;
  12 task 중 6개 캐시), repo 타입/lint, harness 18건, 두 앱 FSD, ops 21파일·262건, format/diff 성공.
- 두 앱 실제 build 성공(2 task·캐시 0). Console 단위와 같은 Sentry/업로드 OFF·local 입력을 사용했다.
- 기존 Web instrumentation 테스트가 raw route를 reporter에 넘기는 것을 검출해 producer에서 먼저 정제했다.
  기존 local OFF·staging/production 활성화 회귀는 유지하고 Dedupe 제외를 같은 검사에 추가했다.
- producer·server 분류·최종 정제·browser 중복과 privacy 회귀의 결합으로 400줄 목표를 넘는다.
  앱 간 import·공용 telemetry package·기능/UI/데이터 정리는 추가하지 않았다.
- 로그: ignored `.local/observability/finish/web-metadata/`. 운영 배포·원격 수신·실제 소스맵 복원은 미실행이다.


### 기존 인증 판정 기반 안전한 거부 사유 — 4번 완료

기준 `8d7303fa76050976ae3eeb653e3f2c71cc312ad1`부터 이 기록을 포함한 커밋까지다.
기존 request cache가 `{ context, decision }`과 요청 내부의 기록 여부를 함께 소유한다.
공통 RequestContext·JWT·DTO·Query cache에는 진단 필드를 추가하지 않았다. guest로 합쳐지던 기존 분기를
고정 reason으로 구분하며 검사 순서·MFA 회수 판정·DB throw를 유지한다. 같은 RSC 요청의 page/layout은
한 번만 기록하고, HTTP/Action은 이미 읽은 같은 객체를 catch에 전달하므로 추가 DB 조회가 없다.
Auth.js CredentialsSignin은 세부 사유를 만들지 않고 generic reason으로 기록한다.

`auth.rejected`는 info JSON뿐이며 SDK capture를 호출하지 않는다. 실제로 만든 HTTP 응답에서만 401/403을
기록하고 RSC 이동·forbidden·Action 거부는 각 관측 결과만 남긴다. 근거가 없으면 unknown이며
계정 ID·email·role 원문·MFA 값·cookie/token·원본 Error/cause를 직렬화하지 않는다.

- 실제 검사: workspace type/lint/unit 성공(90파일·521건; Console 303, Web 127, server 88, contracts 3),
  repo 타입/lint, harness 18건, 두 앱 FSD, ops 21파일·262건, format/diff 성공.
- 사유별 0/1회 DB 조회·원본 DB 예외, 요청 내부 반복/서로 다른 요청, credentials 반복 전달과 민감 값 제거를 검사했다.
- 두 앱 실제 build 성공(2 task·캐시 0). 기존 Sentry/업로드 OFF·local·접근 불가 loopback DB 입력을 유지했다.
- 진단 객체·실제 RSC/API/Action·동일 consumer 회귀를 함께 바꿔 파일/라인 목표를 넘었다.
  범용 logger·인증 framework·전역 사용자 cache·새 DB 조회/의존성은 없다.
- 로그: ignored `.local/observability/finish/auth-rejection/`. 실제 Next 통합 검증은 아래 최종 runtime 기록과 구분한다.

### Console 요청 ID와 JSON·Sentry 연결 — 5번 코드·로컬 정적 검증

기준 `49fb071`부터 이 기록을 포함한 커밋까지다. 관리 화면·로그인·관리/auth API 요청만 Proxy에서
UUID v4를 새로 만들고 외부 public/internal ID와 route 헤더를 덮어쓴다. response의 `X-Request-ID`와
request 내부 ID는 같고, 알려진 template만 전달한다. health/static은 matcher에서 제외한다.
Next hook, HTTP catch, Auth.js, MFA 등록, upload Action과 요청별 인증 사유가 같은 메타데이터를 사용한다.
RSC service 인증 오류 번역은 기존 요청 cache를 다시 읽으므로 추가 DB 조회가 없다.

두 sink는 독립성을 유지한다. JSON은 검증된 request ID·SDK event ID·environment·immutable release와
`requested/disabled/capture_failed`를 기록한다. SDK ID 반환을 원격 수신으로 표현하지 않는다.
동일 Error/동일 유효 request ID만 coordinator에서 억제하고, 다른 Error/다른 요청/ID 없음은 합치지 않는다.
Sentry 실패와 logger 실패는 application 응답을 바꾸지 않는다. 원본 Error는 기존 SDK 경계에 전달한다.
HTTP의 공개 body/DTO는 바꾸지 않고 response header ID를 브라우저 Error의 WeakMap에 연결한다.
최종 server/browser 정제는 `contexts.correlation.request_id`의 UUID만 허용하며 고 cardinality tag는 만들지 않는다.

- 실제 검사: workspace 12 task 성공(9개 캐시), unit 91파일·542건
  (Console 324, Web 127, server 88, contracts 3), repo 타입/lint, harness 18건,
  두 앱 FSD, ops 21파일·262건, format/diff 성공.
- 두 앱 실제 build 성공(2 task·캐시 0). 기존 Sentry/업로드 OFF·local·접근 불가 loopback DB 입력이다.
- 설치 Next의 테스트 helper는 `unstable_doesMiddlewareMatch`였다. 환경/setup 및 필수 ErrorEvent type,
  unknown narrowing과 기존 GET fixture를 맞췄다. upload Action은 같은 headers를 한 번 읽어 Origin 선행 거부를 유지했다.
- producer·실제 delivery consumer·최종 정제·header/privacy 회귀가 연결돼 파일/라인 목표를 넘는다.
  새 auth/DB cache·전역 request context·데이터 재조회·dependency·API envelope는 추가하지 않았다.
- 로그: ignored `.local/observability/finish/console-correlation/`. 실제 Next 요청의 header→hook 연결과
  장애 주입은 다음 runtime 기록에서 판정하며, 통과 전에는 §1 P4-A를 완료 표시하지 않는다.

### 실제 Next 장애·오류 화면·요청 연결 — 1·5번 로컬 완료

기준 `af824641784bda88188ea46fbeee521da8043a31`부터 이 기록을 포함한 커밋까지다.
로컬 검증이 발견한 scope의 이전 선택 필드 잔류를 수정했다. server/browser reporter는 매번 code·route·
operation·request 종류·digest와 correlation의 없는 값도 지운다. 다른 오류/요청의 값을 상속하지 않는다.
최종 event의 code와 같은 ID의 JSON descriptor가 일치하는 것을 실제 수신 payload에서 검사했다.

- 실제 Next 16.4.1 standalone·Chromium·PostgreSQL 17과 실제 Sentry SDK를 사용했다.
  DSN은 `127.0.0.1:3219`의 임시 collector뿐이고 browser 외부 요청은 이 검증 구간에서 차단했다.
  collector가 받은 **35개 로컬 event**를 최종 정제/민감 marker 검사했다. 외부 Sentry 수신이 아니다.
- 기존 albums 페이지/API에만 임시 source overlay를 넣어 검증용 두 앱 build를 만들었다.
  AppError 탈출, unknown render, 실제 service의 제한된 context 거부, 잘못된 output DTO와 HTTP body를 주입했다.
  실제 격리 DB의 임시 app 역할에서 Album SELECT를 잠시 회수하고 finally에서 복구해 DB 읽기 실패도 확인했다.
  모든 app source는 build 직후 복구하고 임시 smoke 연결도 종료 시 복구했다. 상시 실패 endpoint/flag는 추가하지 않았다.
- 탈출 오류와 DB 실패에서 오류 화면 mount와 server hook 이벤트, 원본 frame 보존을 확인했다.
  같은 digest/stack을 가진 서로 다른 요청은 각각 다른 request/event ID를 유지했다.
  HTTP 응답 ID→JSON request ID/SDK 제출 ID→로컬 event ID가 일치했다. 위조한 public/internal ID는 덮어썼다.
- malformed HTTP 오류의 Query 선행 보고 뒤 최초 boundary 보고를 별도 event로 확인했다.
  두 browser event와 서버 output-contract event의 request ID는 같고 event ID는 각각 달랐다.
  정상 ApiError는 기존 Query 정책상 별도 보고하지 않으므로 이 동작을 변경하지 않았다.
  StrictMode/재렌더 억제는 §6의 실제 React fixture와 현재 unit 회귀 범위다.
- 실제 service의 UNAUTHENTICATED는 로그인 route 이동을 요청했고 FORBIDDEN은 실제 Next 거부 화면을 만들었다.
  이 검증은 제한된 context를 주입한 service 경로다. 실제 계정 권한 회수는 AUTH-009의 guest/로그인 이동이며
  이를 실제 계정의 403 검증으로 합산하지 않는다. 정상 RSC 인증 구간의 request_error 0건도 유지했다.
- 이 build의 Next hook에서는 주입한 AppError/DB Error의 클래스 identity가 유지되지 않아 unknown으로 수집됐다.
  render_error_captured/unhandled와 원본 frame은 유지했다. 이름/code를 보고 원래 클래스를 복원하지 않았다.
  알려진 AppError delivery 분류는 unit 검증이며 이를 실제 runtime delivery 판별 성공으로 기록하지 않는다.
  serialized RSC Error에 없는 request ID도 browser에 추정해서 붙이지 않는다.

`node .local/observability/finish/runtime/run.mjs`가 기존 격리 DB runner를 실행해 관리자 전체 smoke를 완료했다.
로그인/MFA·등록·Origin/CSRF·권한 회수·JWT·CRUD·가사 편집/재인증·Web 인증 제거/공개 조회와 로그 민감정보
회귀가 성공했다. 종료 시 연결 0개·advisory lock 0개, 임시 DB·역할 정리가 성공했다.
초기 fixture의 dynamic re-export/필수 props, Next에서의 클래스 손실, 정상 ApiError의 Query 비보고와
이미 로그인한 세션의 login→admin 재이동 때문에 검증이 실패한 기록은 성공으로 세지 않았다.
클래스 손실/정상 거부 정책은 유지하고 fixture 기대를 고쳤으며, 실제로 발견한 scope 잔류만 수정했다.

현재 코드의 workspace 12 task(9개 캐시)·unit 91파일 543건(Console 325, Web 127, server 88, contracts 3),
repo 타입/lint·harness 18건·ops 21파일 262건이 성공했다. 주입 없는 두 앱 정상 build도 2 task·캐시 0개로 성공했고 format/FSD/diff도 성공했다. 검증 source overlay/collector와 결과는 ignored `.local/observability/finish/runtime/`다.
fixture SHA-256은 run `347e68bf7e87293f546607b86bef2941471516af1978142fcead050e0b6e6ef7`,
assert `a9ad680378bbc3c901e774238996f4eaa24715593cd80774b4ac4a8b411713b2`다.

운영 알림·이미지별 실제 Debug ID/소스맵 복원과 외부 Sentry/Slack 수신은 7번 배포 대기다.
**Slack 알림 디자인도 미배포**이며 사용자 수동 Worker 배포 보류를 유지한다.

### Web dynamic/API 요청 연결 — 6번 코드·로컬 완료

기준 `94c56ca53fe9f50963009077369b6fd9d3311b5e`부터 이 기록을 포함한 커밋까지다.
Console의 실제 hook 연결 검증 후에만 Web에 같은 ID·sink·최종 allowlist와 선택 필드 초기화를 적용했다.
Proxy matcher는 기존 dynamic인 `/`, `/chants`, `/songs/*`, `/albums/*`와 두 공개 API family만 포함한다.
정적 안내·약관·health/ready·제거된 인증/admin 경로는 제외하고 internal reader도 그 경로의 caller ID를 거부한다.
root layout에 headers reader를 추가하거나 Web 인증·쿠키·Action을 복구하지 않았다. DTO와 공개 API body도 유지한다.

관련 파일 수가 기존 Shared/lib 권장 상한에 걸려 Web의 Sentry reporter·correlation·같은 테스트를
`shared/lib/sentry/`로 묶었다. 기존 `@/shared/lib/sentry` import는 유지했고 lint 규칙을 끄지 않았다.
다른 lib/설정·패키지·공통 telemetry framework로 정리 범위를 넓히지 않았다.

- 실제 검사: workspace 12 task 성공(9개 캐시), unit 92파일·569건
  (Web 153, Console 325, server 88, contracts 3), repo 타입/lint, harness 18건, ops 21파일·262건 성공.
  최초 matcher fixture의 경로 중복 치환은 올바른 소유 경로로 수정했다.
- `node .local/observability/finish/runtime-web/run.mjs`는 기존 runner의 격리 DB·역할·앱 시작/정리 경로에서
  변경한 요청 경로의 진단 검증을 실행했다. 이 실행은 C2/D/CRUD 전체를 반복한 결과로 세지 않는다.
  해당 전체 smoke는 앞 Console runtime 절의 실제 실행과 구분한다.
- 실제 Web DB fixture의 home/chants/song/album과 두 API 정상 200/DTO를 확인했다.
  안내·약관·health/ready에는 response ID가 없고 제거된 auth/admin은 계속 404였다.
  기존 `assertWebAdminRetired`로 guest/legacy USER/ADMIN·오래된 upload Action 거부와 공개 조회도 확인했다.
- 임시 기존 songs page/API overlay에서 실제 render 오류·output 계약 오류·malformed HTTP를 주입했다.
  서버 event와 response/JSON ID 연결, 다른 요청의 별도 event, 실제 global 오류 화면의 mounted outcome,
  Query 선행 보고 후 별도 최초 boundary event와 같은 HTTP ID를 확인했다. 원본 source는 모두 복구했다.
- 두 앱 실제 SDK의 최종 **24개 로컬 event**를 loopback collector에서 수신했고 민감 marker 부재를 검사했다.
  Console의 앞 장애/요청 연결 진단도 같은 build에서 재실행했다. 임시 DB는 연결/lock 0개 확인 후 역할과 함께 정리됐다.
- 주입 build의 두 앱 2 task·캐시 0개 성공 후, 주입 없는 정상 local build를 별도로 실행했다.
  Sentry/업로드 OFF·빈 DSN과 기존 접근 불가 loopback DB/임시 Console 입력을 사용한다.
  최종 정상 build도 두 앱 2 task·캐시 0개로 성공했다. Web route tree의 정적/동적 표기는 변경 전과 같고
  FSD/format/diff도 성공했다.

검증 로그는 ignored `.local/observability/finish/web-correlation/`, runtime fixture/event는
`.local/observability/finish/runtime-web/`다. fixture SHA-256은 run
`384dda0261bf649ef3a22ed61a863c61df179eb5fd08de60a5f8b5685df99275`, assert
`cc889b51b362223abea1407537113c570cf824d989088ac82f4b855b4cc15956`다.

**승인 범위의 1~6번은 코드·로컬 검증 완료다. 7번은 배포 대기**다. 외부 Sentry/Slack 수신·production 알림 규칙 변경·
이미지별 Debug ID와 실제 source map 복원은 실행하지 않았다. **Slack 알림 디자인은 미배포**이며 사용자 수동 Worker
배포 보류를 유지한다. 새 PR·병합·OCI/Worker 배포·외부 알림·운영/개인 설정 변경은 하지 않았다.
