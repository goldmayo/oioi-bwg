---
title: "오류 원인·처리 결과 추적 개선 계획"
document_id: "OBSERVABILITY-ERROR-TRACKING-PLAN"
kind: migration-plan
version: "1.1"
status: active
authority: plan
created_at: "2026-10-22"
updated_at: "2026-10-22"
source:
  repository: goldmayo/oioi-bwg
  branch: migration_main
  commit: 4d5e42dac37aeb13b3279b47a7907fbb7bc91be2
observed_at: "2026-10-22"
depends_on:
  - "03"
  - "04"
  - "09"
related:
  - "OBSERVABILITY-AUDIT"
  - "OBSERVABILITY-SERVER-ERROR-DIAGNOSTICS-RESULT"
  - "OBSERVABILITY-LOGGING-ERROR-TRACKING-SEPARATION-RESULT"
---

# 오류 원인·처리 결과 추적 개선 계획

> 2026-10-26 정리: 코드·로컬 검증과 이후 배포/실수신을 구분한다. 원래 운영 수용 항목 전체의 최종 근거는 미확인이다. 아래 staging 표현은 최초 계획 당시의 범위다. 현재 상태·다음 행동은 [WORK](../../WORK.md)를 따른다.

## 1. 목적과 범위

정상 처리된 인증 거부는 장애 알림에서 제외하고, 처리되지 않은 인증 오류·실제 시스템 장애는
원인 코드와 관측한 처리 결과를 보존한다. 사용자 요청은 구현에 앞서 검토할 계획 수립이며,
이 문서의 단계는 아직 구현·배포·수신 검증을 완료했다는 의미가 아니다.

우선순위는 **① 오류 코드·처리 결과 → ② 앱·경로·작업 → ③ 인증 판단 사유 → ④ 요청 ID 연결**이다.
Console의 RSC/API/Action/Auth.js와 두 앱의 오류 수집 경계를 대상으로 한다. 공개 Web에는 인증을 복구하지 않는다.
Sentry와 JSON 운영 로그를 유지하고, 신규 logger library·전 runtime wrapper·DB 변경·Replay·분산 tracing·
원문 breadcrumb·사용자 식별·전체 access log·오류율용 metrics 구축은 범위에서 제외한다.

## 2. 근거와 규범

- 기준 코드는 위 full SHA의 깨끗한 tree다. fetch한 `origin/migration_main`에서 계획 브랜치를 분기했다.
  local `migration_main`은 `5135f6eb1a53782b86a3120b1d8b0134410bf4d4`여서 기준으로 쓰지 않았다.
- 규범: [헌법](../oioi-bwg-architecture-clean-v1/01-architecture-constitution.md),
  [03 §23~24](../oioi-bwg-architecture-clean-v1/03-api-error-architecture.md),
  [04 §4.0~4.1](../oioi-bwg-architecture-clean-v1/04-auth-authz-architecture.md),
  [09 §12~15·18](../oioi-bwg-architecture-clean-v1/09-error-ux-observability.md),
  [10](../oioi-bwg-architecture-clean-v1/10-testing-architecture.md),
  [Domain AUTH-001·009](../DOMAIN_SPECIFICATION.md).
- 기존 기록: [audit](OBSERVABILITY-AUDIT.md),
  [원본 frame 보존](OBSERVABILITY-SERVER-ERROR-DIAGNOSTICS-RESULT.md),
  [logging/tracking 분리](OBSERVABILITY-LOGGING-ERROR-TRACKING-SEPARATION-RESULT.md),
  [client privacy](OBSERVABILITY-CLIENT-SENTRY-RESULT.md),
  [source map](OBSERVABILITY-SENTRY-SOURCEMAPS-RESULT.md),
  [Web 인증 제거](console-guide-editor/P06-E3-RESULT.md). 과거 RESULT를 현재 설계로 덮어쓰지 않는다.

### 2.1. 이번 대화에서 API로 확인한 Sentry 증거

2026-10-22 조회 당시 snapshot이며 이후의 발생 건수나 해결 상태를 보장하지 않는다.

| 이슈 / 이벤트                                                                                      | 시각(KST) / 배포 source                                     | 확인한 사실                                                                                                        |
| -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| [OIOI-BWG-B](https://oioibawige.sentry.io/issues/7804933654/) / `fda3612d4944447cba5792a9b0c7d602` | 10/22 00:59:02 / `070a805b78b4f134c32778f9e045cc4b62fbc90a` | staging, GET render, 1회, 미해결. `AdminAlbumsPage` → service → `requireUser`의 `AppError("UNAUTHENTICATED")` 위치 |
| [OIOI-BWG-A](https://oioibawige.sentry.io/issues/7804647059/) / `00decca427e44338a67c1839363b2964` | 10/21 22:39:12 / `9e09077ac4949b4b105582a1c3c759a3f9515e48` | staging, GET render, 1회, 미해결. `AdminSongsPage` → service → 같은 인증 검사 위치                                 |

두 이벤트는 `UnknownError: Unexpected server error`로 수집됐다. 소스맵으로 throw 위치는 확인했지만,
세션/MFA의 거부 사유·응답 status·실제 화면 결과는 확인하지 못했다. 세션 만료나 사용자 장애를 단정하지 않는다.
해당 throw와 Console 앨범 page/layout은 B의 배포 source와 계획 기준 사이에 diff가 없다.

### 2.2. 현재 코드에서 확인한 공백

| 경계             | 코드 근거와 공백                                                                                                                                                                          |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Console RSC      | `apps/console/src/app/(admin)/admin/layout.tsx`만 로그인 이동/forbidden을 수행한다. albums·songs·edit page는 service를 바로 호출한다. layout 검사만으로 하위 route 실행을 제어할 수 없다. |
| Next 오류 hook   | 두 앱의 `src/instrumentation.ts:onRequestError`가 오류를 일괄 보고한다. 최종 HTTP 응답을 받는 hook은 아니다.                                                                              |
| 서버 분류·정제   | 두 앱의 `src/server/observability/safe-server-event.ts`가 AppError code를 인식하지 못하고 대부분 unknown으로 축약한다. 허용 code는 현재 SQLSTATE·고정 관측성 code 중심이다.               |
| HTTP/Auth/Action | Console `src/server/http/api-response.ts`, `auth-error-reporter.ts`, upload Action은 처리한 AppError/CredentialsSignin을 제외한다. 이 동작과 원본 stack 보존을 유지해야 한다.             |
| 인증 context     | Console `src/server/auth/request-context.ts:loadRequestContext`의 여러 실패 분기가 같은 guest로 합쳐진다. DB 장애는 예외로 남으며 정상 guest와 구분해야 한다.                             |
| 로그 연결        | `reportServerError`는 JSON log 후 Sentry capture를 호출한다. JSON에 event ID·release·request ID가 없고 양 앱에 현재 Proxy 진입점도 없다.                                                  |
| Browser          | sanitizer가 추가 context를 폐기한다. navigation breadcrumb는 query/hash만 제거하므로 동적 path도 template으로 제한할 필요가 있다. WeakSet dedupe는 같은 Error 객체에만 적용된다.          |

Next는 이 저장소 manifest/lockfile상 16.4.1이나 조사 환경의 로컬 설치는 16.3.3이었다.
`routePath`와 request headers는 이 로컬 설치의 instrumentation type에서 확인한 사실이다.
구현 검증 전 frozen lockfile 설치로 16.4.1과 일치시키고, header 전달·hook Error identity를 다시 확인한다.
공식 문서도 조회 시 16.4.2이므로 현 runtime 계약을 대신하는 검증 결과로 사용하지 않는다.

## 3. 우선순위 1: 오류 의미와 처리 결과

### 3.1. 수집 결정

| 실제 관측한 상황                                                   | 운영 기록                                   | Sentry    |
| ------------------------------------------------------------------ | ------------------------------------------- | --------- |
| 알려진 인증 AppError를 RSC가 로그인 이동/forbidden으로 번역        | 요청별 안전한 인증 거부 요약                | 제외      |
| API가 AppError를 기존 401/403 응답으로 생성                        | 같은 거부 요약 + 생성한 status              | 제외      |
| Auth.js의 정상 CredentialsSignin / Action의 처리된 인증 거부       | 허용된 generic 거부 요약                    | 제외      |
| 인증 AppError가 번역되지 않고 Next render 오류 경계로 탈출         | delivery 오류 + 원래 AppError code          | 수집      |
| 세션 확인 중 DB/network/프로그램 오류, output/client contract 위반 | unexpected/contract 오류 + 안전한 원인 code | 수집      |
| 원본 오류나 처리 여부를 판별할 증거 없음                           | unknown + 남아 있는 frame                   | 수집 유지 |

`instanceof AppError`나 status만으로 전역 discard하지 않는다. 처리된 거부는 delivery adapter에서 끝내고,
탈출한 인증 AppError는 **예상하지 못한 delivery 처리 실패**로 분류한다. 새로운 도메인 AppError code를
추가하거나 기존 401/403·MFA 정책을 바꾸지 않는다. 404/409 등 다른 expected failure의 계약도 보존한다.

### 3.2. 기록 계약 제안

- `error.type`: 기존 분류에 `application`을 추가해 알려진 AppError임을 보존한다.
  `error.code`는 contracts의 기존 code 집합과 별도의 고정 관측성/DB code allowlist에서만 얻는다.
  `error.name`·message·details·arbitrary cause를 자유형으로 기록하지 않는다.
- `failure.kind`: `delivery | system | contract | unknown`. 정상 거부에는 failure를 만들지 않는다.
  원본 Error를 SDK에 넘겨 stack을 유지하고, 전송할 exception 이름/message는 분류별 고정 문구를 사용한다.
- `handling`: `handled | unhandled | unknown`. 확인한 boundary의 처리 사실만 기록한다.
- `outcome`: `response_created`, `login_redirect_requested`, `access_denied_requested`,
  `action_rejection_returned`, `render_error_captured`, `error_boundary_mounted`, `unknown`.
  마지막 세부 명칭은 계약 PR에서 enum·fallback·producer와 함께 확정한다.
- `http.status_code`는 직접 만든 API Response에서만 기록한다. redirect 호출을 307 확정이나 사용자 도착으로,
  render hook을 500 응답이나 오류 화면 표시로 바꾸어 기록하지 않는다. streaming의 200도 성공 판정 근거가 아니다.
- Browser Error Boundary가 mount되면 기존 capture 경로에 `error_boundary_mounted`를 부여한다.
  server capture는 실제 UI 결과를 모르면 그 상태로 남긴다. 정상 브라우저 동작을 원격 log/breadcrumb로 보내지 않는다.
  Query cache가 먼저 보고한 같은 Error 때문에 boundary 결과가 사라지지 않도록 dedupe를 producer/outcome별로
  제한한다. boundary 재렌더의 반복은 제거하고 최초 UI 실패 관측은 별도로 보존한다.
  전송한 이전 event를 갱신했다고 가정하지 않으며, 두 관측 event를 두 요청의 장애로 합산하지 않는다.

### 3.3. 구현 경계

Console `src/server/auth`의 작은 app adapter를 albums·songs·edit page와 layout에서 재사용해 service 호출
전에 같은 context의 사용자·ability를 검사한다. 인가 사실은 기존 request cache를 재사용한다.
service의 인증·인가 검사도 유지한다. service가 던진 알려진 인증 AppError는 RSC delivery에서 번역하고,
unexpected error는 원본으로 다시 throw해 Next hook이 수집하도록 한다.
`redirect()`/`forbidden()`의 framework 제어 예외를 범용 catch로 먹지 않는다.

Next hook의 Error는 React 처리로 원본 identity/properties를 잃을 수 있다. code를 확인할 수 없으면
message에서 추측하지 않는다. 안전한 digest는 보조 context로 보존하되 request/user ID처럼 취급하지 않는다.
API/Auth/Action/Next의 동일 원본 Error 중복은 검증된 request 범위에서만 줄인다.
server와 browser 결과는 별도 관측이며 무조건 합치거나 중복 이벤트를 전부 버리지 않는다.

## 4. 우선순위 2: 앱·경로·작업

| 필드                                | 생성·검증 기준                                                                                                        |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `app`                               | 앱 코드의 고정 `web`, `console`. hostname/header에서 추론하지 않는다.                                                 |
| `environment`, `release`            | 기존 APP_ENV와 immutable source SHA/release 규칙 재사용. JSON log에도 같은 값 투영                                    |
| `runtime`, `source`                 | 고정 browser/node 및 현재 producer allowlist. event별 request scope에만 설정                                          |
| `route.template`                    | `/admin/albums`, `/admin/songs`, `/admin/edit/[slug]`, `/api/admin/albums/[id]` 등 앱이 소유한 정적 목록              |
| `operation`                         | `admin-album-list`, `admin-song-list`, `admin-song-edit-load`, 기존 `album-image-upload` 등 실제 consumer의 고정 이름 |
| `request.method`, route/router kind | 기존 allowlist 유지. 입력 header/URL/body 전체는 기록하지 않음                                                        |

RSC/API/Action 호출부의 정적 metadata가 우선이다. Next `context.routePath`는 확인된 framework route 형식을
정적 template map에 대응시킨다. Browser도 route identity로 매핑하고 동적 값은 보존하지 않는다.
단순 query/hash 제거·`[id]` 정규식 하나·`request.path` 복사는 허용하지 않는다.
unknown 경로는 생략하거나 고정 unknown으로 축약하며 raw path를 fallback으로 보내지 않는다.
navigation breadcrumb의 from/to도 같은 제한을 통과시키고 매핑 불가 항목은 버린다.

작은 enum은 검색용 Sentry tag, 복합 진단과 고유 ID는 별도 context로 둔다. 요청별 ID·timestamp·release를
custom fingerprint에 넣지 않는다. 기존 grouping과 source map이 유지되는지 먼저 확인하고 불필요한 fingerprint는 만들지 않는다.

## 5. 우선순위 3: 개인정보 없는 인증 판단 사유

Console auth adapter 내부의 request-cached 결과를 `{ context, decision }`으로 구성하고,
기존 `getRequestContext()`는 같은 core RequestContext만 반환한다. 별도 app-local reader만 안전한 decision을
소비한다. core type/서비스 인자·JWT·session·API DTO·Query cache에는 진단 필드를 추가하지 않는다.
새 DB 조회나 secret 조회 없이 기존 분기를 아래 순서로 분리한다.

| 관측한 분기                         | 내부 reason 후보                           |
| ----------------------------------- | ------------------------------------------ |
| 세션 사용자 identity 없음           | `no_valid_identity`                        |
| MFA 증명 없음/형식 불일치           | `mfa_proof_missing`                        |
| Account ID 형식/범위 불일치         | `invalid_identity`                         |
| 기존 inner join 조회 결과 없음      | `authorization_facts_missing`              |
| Account 비활성 / ADMIN 아님         | `account_inactive` / `admin_role_required` |
| enabledAt 없음 / MFA version 불일치 | `mfa_disabled` / `mfa_version_mismatch`    |
| 기존 검사 통과 / 사유 판별 불가     | `authorized` / `unknown`                   |

`findConsoleAuthorizationFacts`는 Account와 admin_mfa의 inner join이므로 행 부재를 account 삭제로 단정하지 않는다.
null 세션을 만료/쿠키 누락/위조로 세분하지 않는다. DB throw는 `authorization_facts_missing`으로 바꾸지 않는다.
최초로 확인한 거부 분기 하나만 기록하고 진단 때문에 인증 순서나 외부 응답을 바꾸지 않는다.
CredentialsSignin은 계정 존재·비밀번호·OTP의 세부 사유를 만들지 않고 generic 거부로 유지한다.

처리한 거부는 전용 typed JSON event `auth.rejected`로 1요청 1회 기록한다. 범용 info/warn logger를 만들지 않는다.
기본 level은 info이고 Sentry issue/captureMessage로 보내지 않는다. 같은 request 안의 page/layout 반복을 합치고,
로그량이 커지면 app/reason별 제한된 시간창의 생략 건수를 집계한다. 사용자별 추적 key나 IP는 사용하지 않는다.
unexpected event의 auth context도 필요하고 이미 계산된 경우에만 같은 enum을 첨부한다.

계정 ID·email·role 원문·MFA version 값·OTP·QR/secret·cookie·JWT·credential·header·form/body·SQL/params·
DB row·raw Error/cause는 모든 sink에서 금지한다. hash한 사용자 ID도 이번 범위에 도입하지 않는다.

## 6. 우선순위 4: 요청·이벤트·운영 로그 연결

### 6.1. 신뢰할 수 있는 ID 생성과 전달

현재 Proxy가 없으므로 Console에 `src/proxy.ts`를 추가하는 별도 runtime checkpoint로 진행한다.
`/admin/:path*`, `/admin-login`, `/api/admin/:path*`, `/api/auth/:path*`를 대상으로
매 네트워크 요청에 서버가 새 UUID를 생성한다. Next matcher의 정적 prefix 경계도 검증한다.
수신 `X-Request-ID`와 같은 이름의 내부 전달 header는 재사용하지 않고 덮어쓴다.
UUID 형식만 맞는 임의 caller 값도 신뢰하지 않는다. browser·재시도·prefetch는 각각 다른 요청 ID다.

Proxy는 `NextResponse.next({ request: { headers } })`로 생성한 ID만 app에 전달한다.
기존 요청 header는 전달에 필요한 만큼 유지하지만 log/context로 직렬화하지 않는다.
인증·DB 조회·Caddy/Origin 재작성·별도 rewrite/fetch는 넣지 않는다. process-global state로 넘기지 않는다.
RSC/Action은 app-local server reader, API는 request boundary, Next hook은 전달받은 request header에서 읽는다.
누락 시 module-global ID를 쓰지 않고 연결 불가로 남긴다. producer마다 새 ID를 만들어 같은 요청인 척하지 않는다.

API Response에 같은 `X-Request-ID`를 붙이고 browser HTTP 정규화에서 검증된 ID만 error의 안전한 local
진단 metadata로 보존한다. response body/envelope와 `ApiError`의 공개 code/message 계약은 유지한다.
이는 이미 발생한 API 오류·UI 실패의 연결용이며, 정상 요청마다 client error를 생성하지 않는다.
RSC의 서버 오류와 browser boundary는 안전한 digest를 보조 근거로만 비교하며 동일 요청으로 확정하지 않는다.
Proxy response에 ID를 붙여도 최종 status는 알 수 없으므로 별도 completion log로 간주하지 않는다.

Web은 별도 PR로 실제 dynamic data route/API에만 같은 원칙을 적용한다. root layout 전체에서 headers를
읽거나 retired auth route·static asset·health에 관측성을 억지로 확장하지 않는다.
static/cache·locale·Flight·Action forwarding이 보존되는 installed Next build smoke를 선행한다.
console에서 RSC → hook ID 일치가 입증되기 전에는 Web 전체로 확장하지 않는다.

### 6.2. 두 sink 연결과 실패 격리

coordinator가 capture 반환값을 받아 JSON에 `sentry_event_id`를 추가한다. Sentry event에는 고정 형식의
`request_id` context, JSON log/HTTP에는 같은 vocabulary를 사용한다. 기존 event ID도 실제 형식을 검증한다.
JSON의 `sentry_submission`은 `requested | disabled | capture_failed`로 직접 관측한 호출 결과만 기록한다.
Sentry OFF/동기 호출 실패라면 event ID는 생략하고 JSON 원인·request ID는 계속 기록한다.
정제 discard나 transport 실패는 ID 반환 뒤에도 일어나므로 수신 성공/실패로 추정하지 않는다.
logger와 Sentry reporter의 직접 의존을 복구하지 않고 coordinator만 두 sink를 조합한다.
capture 실패나 metadata getter 오류 때문에 원래 응답/예외·로그가 사라지지 않게 한다.
event ID 반환은 SDK 수락 표시이며 원격 수신 증거는 별도로 확인한다. 요청마다 flush하지 않는다.

## 7. 구현 checkpoint와 예상 변경 위치

각 행은 독립 검증 가능한 PR이다. 일반 PR 대상은 `migration_main`이고 최신 merge head에서 순서대로 분기한다.
20파일/400줄 목표를 넘으면 해당 concern 안에서 계약·consumer 적용을 추가 분리한다.
예상 파일은 범위 식별용이며 완성 전 정확한 diff 규모를 재산정한다.

| 순서 | checkpoint / 변경 위치                                                                                                                | 완료 기준                                                                                                |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| P1-A | 03 §23·09 §12~15의 handled/unhandled 의미·허용 metadata를 먼저 개정하고 index 버전 동기화. Console safe-server-event/reporter 및 unit | 정상 AppError 제외와 delivery 결함 수집이 규범에서 양립하고 code·outcome 정제가 고정됨                   |
| P1-B | Console auth/RSC adapter, admin layout·albums·songs·edit page, instrumentation·client boundary와 대응 test                            | 직접 진입·navigation·재인증 흐름에서 정상 거부는 login/403, 탈출한 예외는 수집. framework 제어 예외 보존 |
| P2-A | Console server/client safe policy, instrumentation·API·Action metadata, breadcrumb와 test                                             | app/template/operation이 최종 전송 payload에 남고 동적 값은 제거됨                                       |
| P2-B | Web의 현존 instrumentation·HTTP·server/client policy와 test                                                                           | 같은 안전한 분류·metadata·outcome을 사용하고 제거된 인증 기능을 다시 만들지 않음                         |
| P3   | Console request-context의 cached decision, typed auth rejection log, 실제 consumer와 test                                             | 기존 DB 조회 수·인증 결과 동일, 모든 reason 분기와 unknown이 검증됨                                      |
| P4-A | Console Proxy·request reader, coordinator/logger, API response·HTTP error 정규화와 test                                               | 동일 request ID가 RSC/API/Action/hook·JSON/Sentry에 연결되고 위조·동시 요청이 분리됨                     |
| P4-B | Web의 dynamic/API 요청 연결과 build/browser smoke                                                                                     | 공개 조회·cache/locale/static/health 동작을 유지하며 해당 오류의 요청 연결을 확인                        |

새 공용 telemetry package·Generic Guard·자동 모든 route wrapper는 만들지 않는다.
app-local 설정과 작은 plain helper를 사용하고 client가 server/auth를 import하지 않게 한다.
새 metadata를 SDK에 설정하는 변경과 `beforeSend` 최종 allowlist 변경·회귀 검증은 같은 PR에 넣는다.
각 checkpoint 결과는 이 계획을 참조하는 RESULT에 실제 commit/PR·명령·한계로 기록한다.

## 8. 검증 계획과 완료 조건

아래는 **구현 때 수행할 검증**이며 이번 계획 작성에서 통과한 결과가 아니다.

### 8.1. 의미·privacy·동시성

- table-driven unit: 처리된 UNAUTHENTICATED/FORBIDDEN은 Sentry 0건, unhandled 인증 오류·DB 장애·contract
  위반은 수집. unknown/React가 가공한 Error도 보수적으로 수집하며 raw message로 분류하지 않는다.
- 기존 `server-logger.test.ts`, coordinator·HTTP·auth context test를 확장하고 Console instrumentation test를 추가한다.
  정상 upload/로그인 거부·404/409·MFA 회수 동작과 원본 Error identity/frame 보존을 회귀 확인한다.
- server/client beforeSend의 최종 serialized payload에 필수 새 필드가 남는지와 민감 marker 부재를 확인한다.
  URL 동적 segment/query/hash·form·QR/OTP·header·SQL·raw cause·unknown enum·hostile getter를 함께 넣는다.
- request ID caller 위조/길이/개행·malformed ID·같은 요청 반복·두 동시 사용자 요청·다른 prefetch/재시도·
  logger/Sentry 한쪽 실패/OFF를 검증한다. module-global user/request context 누출이 없어야 한다.
- Query cache → Error Boundary 순서에서도 UI 실패 관측을 잃지 않고, StrictMode/재렌더가 같은 boundary 결과를
  반복 전송하지 않는지 확인한다. 다른 오류를 전역 시간창/digest만으로 묶어 제거하지 않는다.

### 8.2. 실제 Next runtime

- 승인된 로컬 dump를 복원한 Docker Compose PostgreSQL과 local 환경에서 Playwright로 검증한다.
  임의 seed나 운영 DB 연결을 추가하지 않고 기존 관리자 smoke 실행 경로를 확장한다.
- anonymous 직접 진입·client navigation·세션 회수 뒤 이동·정상 ADMIN·권한 거부의 albums/songs/edit를 확인한다.
  정상 거부는 실제 login/403 UX이며 보호된 데이터는 조회하지 않는다. 코드 unit만으로 RSC 결과를 보증하지 않는다.
- local 전용 mock/fixture로 세션 DB 장애·service AppError 탈출·unexpected render/contract 오류를 주입한다.
  오류 화면과 수집 여부를 관측하고, 외부에서 접근 가능한 상시 강제 실패 endpoint를 추가하지 않는다.
- manifest/lockfile과 설치 일치 확인 후 Next 16.4.1 standalone에서 HTML/Flight/Action/API의 header 전달과 hook/response ID 일치를 확인한다.
  표준 테스트 transport로 event를 가로채 local 기본 Sentry OFF 정책과 별개로 payload 경계를 검사한다.
- 기본 `pnpm type-check`, `pnpm test:harness`, `pnpm lint`, `pnpm lint:fsd`, `pnpm test:unit:run`,
  `pnpm format:check`와 runtime/build 변경의 `pnpm build`를 실행한다. Proxy/ingress 변경은 관련 `pnpm test:ops`도 실행한다.

### 8.3. 운영 수신과 완료 판정

구현 PR 병합만으로 배포하지 않는다. 별도 Promotion과 기존 runbook에 따라 검증한 동일 candidate digest를
staging에 적용한 뒤, 민감정보 없는 제한된 검증으로 다음을 확인하고 RESULT에 증거를 남긴다.

1. 정상 인증 거부는 안전한 JSON decision/outcome만 남고 Sentry/Slack 장애 알림은 생성하지 않는다.
2. 실제 장애 event에 code/classification·app/template/operation·관측한 outcome·release·원본 frame이 남는다.
3. 연결 대상 event의 request ID로 JSON log를 찾고, 반환된 event ID를 Sentry API에서 실제 조회할 수 있다.
4. 같은 요청의 server capture 중복과 browser 관측을 구분하고, 서로 다른 요청/사용자가 섞이지 않는다.
5. 양쪽 실제 payload에 개인정보·동적 URL 값이 없고, 민감정보 제거 때문에 수집 자체가 전부 꺼지지 않는다.

수신 실험 없이 SDK event ID만 얻으면 원격 검증은 미완료로 기록한다. OCI log 접근이 없으면 log 연결도
별도 미확인으로 남긴다. 실사용자/운영 쓰기 실패를 인위적으로 만들지 않으며 DB/비밀값·MFA 상태를 변경하지 않는다.
기존 A/B 이슈는 배포·재현 결과 확인 뒤에만 해결 여부를 판단한다. 계획 PR에서 resolve/ignore하지 않는다.
Slack relay의 새 필드 표시·알림 빈도 조정은 payload 확인 후 별도 concern으로 다루고 unknown 장애를 일괄 차단하지 않는다.

## 9. 위험·보류와 실행 진입 조건

- 03의 `AppError → no capture`와 09의 expected failure 원칙은 handled 여부를 명시해야 한다.
  P1-A에서 두 문서를 함께 명확히 하고 index를 갱신한다. 헌법·Domain의 권한/오류 의미는 바꾸지 않는다.
  규범 간 새 충돌이 확인되면 상위 문서부터 같은 변경 단위에서 해결한다.
- root 오류 boundary에서 request metadata를 얻을 수 없으면 unknown을 허용한다. 전체 layout을 dynamic하게
  만들거나 사용자 진단 정보를 Client Component로 전달해 빈칸을 채우지 않는다.
- 현재 Sentry userCount 0은 사용자 영향 없음의 증거가 아니다. 사용자 ID 없이 발생·작업·배포별 건수를 보고,
  전체 요청 분모가 없는 상태에서 오류율을 제시하지 않는다.
- requester-generated ID 신뢰·프로세스 전역 mutable context·서비스에서 Next/HTTP import·원문 cause 복구는
  이 계획의 대안이 아니다. ID 전달이 불가능한 경계는 연결 범위를 축소하고 근거를 기록한다.
- 진행 전 각 checkpoint의 최신 merge head·실제 코드·문서 버전을 다시 대조한다. 실행이 시작되면 원래 계획을
  결과에 맞춰 덮어쓰지 않고 변경 이유를 addendum으로 남긴다. 이번 계획의 runtime·staging 검증은 전부 미실행이다.

## 10. 공식 자료

2026-10-22 조회. 동작 설명의 근거이며 저장소 규범을 대체하지 않는다.

- [Next 인증: layout/데이터 경계 검사](https://nextjs.org/docs/app/guides/authentication#layouts-and-auth-checks)
- [Next redirect: throw와 catch 주의](https://nextjs.org/docs/app/api-reference/functions/redirect#behavior)
- [Next instrumentation: hook Error와 routePath](https://nextjs.org/docs/app/api-reference/file-conventions/instrumentation#onrequesterror-optional)
- [Next Proxy: 요청 header 전달과 matcher](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
- [Sentry filtering](https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/filtering/)
- [Sentry tags/context](https://docs.sentry.io/platforms/javascript/guides/nextjs/enriching-events/)
- [Sentry sensitive data](https://docs.sentry.io/platforms/javascript/guides/nextjs/data-management/sensitive-data/)

## 11. 2026-10-22 피드백 반영 — 알림과 소스맵 운영 검증

사용자가 위 계획을 기반으로 실제 적용을 요청했다. 최초 계획·관측 snapshot은 보존하며 실행 결과는
checkpoint별 RESULT가 소유한다. 이 절은 계획 보완이며 외부 설정·배포·수신 완료를 뜻하지 않는다.
P1-A부터 작은 단위로 구현하고 기존 §7의 concern 분리와 최신 `migration_main` 분기 원칙을 유지한다.

### 11.1. 현재 구조와 보완 판단

- [Slack relay 결과](SENTRY-SLACK-RELAY-RESULT.md)에는 Worker 배포·staging 새 이슈·Slack 실제 수신과
  재발생 시 중복 알림 억제를 사용자가 확인한 기록이 있다. 이는 현재 가용성을 재조회한 증거는 아니지만
  “알림 연동 부재”의 근거로도 삼을 수 없다. 기존 relay·채널·secret 소유권을 유지하고 새 연동을 만들지 않는다.
- 오류 분류와 최종 sanitizer를 함께 바꾸는 방향, 정상 거부와 탈출한 delivery 오류의 구분은 채택한다.
  작은 enum은 tag에, 서버가 생성한 request ID는 context에 둔다. 원문 URL·사용자 ID·MFA 정보는 추가하지 않는다.
- JSON logger와 Sentry reporter는 독립 sink를 유지한다. 연결은 §6의 coordinator가 소유하며 logger를
  Sentry transport로 바꾸지 않는다. 공개 Web에 제거된 인증·메일·미래 도메인 기능을 복구하지 않는다.

### 11.2. 알림 보완 checkpoint — 분류와 payload 배포 뒤 별도 수행

| 규칙      | 조건                                     | 정책                                      |
| --------- | ---------------------------------------- | ----------------------------------------- |
| 계약 위반 | production의 새로운 contract 이슈        | 계정이 지원하는 최소 간격으로 전달        |
| 신규 장애 | production 새 이슈, 확인된 contract 제외 | 기존 relay 사용, 필요 시 30분 재알림 제한 |
| 장애 재발 | production의 resolved 이슈 regression    | 최소 간격으로 전달                        |

세 규칙은 environment를 명시하고 staging 검증 규칙과 구분한다. missing/unknown 분류가 일반 장애에서
빠지지 않는지, 기존 이슈·회귀와 새 이슈가 중복 알림을 만드는지 실제 계정에서 먼저 확인한다.
즉시 전달은 처리 목표이며 전달 지연의 SLA가 아니다. 새 분류와 안전한 표시 필드가 relay 최종 payload에
남아야 할 때만 Worker allowlist와 회귀를 함께 보완한다. 배포 Slack webhook은 그대로 분리한다.

Sentry의 frequency는 재알림 간격이며 여러 이슈를 30분 요약으로 묶는 기능의 증거가 아니다.
진짜 digest는 상태·queue 설계가 필요하므로 보류한다. fatal 전용·절대 건수 급증·규칙 자동 생성도 보류한다.
수동 규칙의 조건·실제 환경·검증 결과를 기록하고 기존 규칙을 읽기 전에 삭제하거나 중복 생성하지 않는다.

### 11.3. 소스맵 운영 검증 checkpoint — 업로드 성공과 심볼리케이션 분리

- Web/Console 각각의 project·DSN 대상, image digest·`buildSourceSha`·Sentry release를 대조한다.
  선택적 재사용 이미지는 과거 build source를 유지하므로 Promotion의 현재 source SHA로 덮어쓰지 않는다.
  같은 project/release 안에 두 앱 artifact가 있어도 단순 개수나 project 전체의 존재 여부로 합격시키지 않는다.
- 새 이미지의 bundle에서 나온 안전한 새 이벤트별로 Debug ID·배포 artifact·원본 frame 대응을 확인한다.
  devtools eval 오류와 과거 이벤트는 판정 입력으로 쓰지 않는다. event ID 반환·upload 로그·release 조회·
  실제 복원은 별도 증거다. API의 “some artifact” flag만으로 앱별 일치를 보증하지 않는다.
- 일반 verify의 외부 비의존 원칙을 유지하고 Promotion/배포 후 별도 gate에서 제한된 재시도와 deadline을
  사용한다. Summary에 앱별 source·release·검증 상태를 남기고 기존 배포 알림과 중복되지 않게 실패만 알린다.
  build token이 조회 권한도 가진다고 가정하지 않으며 필요한 읽기 권한과 외부 검증 접근을 먼저 확인한다.
- 외부 알림 설정, synthetic 이벤트 전송, source-map API 확인은 해당 checkpoint의 실행 범위다.
  이번 P1-A에서는 외부 서비스·VM·Vault·DB를 변경하거나 사용자 장애를 인위적으로 만들지 않는다.

공식 근거: [Sentry 알림 frequency/environment](https://docs.sentry.io/api/monitors/create-an-alert-for-an-organization/),
[이벤트별 source-map 진단](https://docs.sentry.io/api/events/get-debug-information-related-to-source-maps-for-a-given-event/).
