# M7-DATA-004

## Status

REWORK

## PLAN

### Finding

`DATA-004 — Sensitive DB error logging`

현재 Drizzle 오류의 message와 cause에는 SQL 및 query params가 포함될 수 있고, 서버 오류 경계가
그 원본 객체를 console과 Sentry에 전달한다. credential/challenge query의 params에는 email,
password hash, OTP hash, IP가 들어갈 수 있으므로, 서버 관측 경계에서 원본 오류를 안전한
allowlist 형태로 바꿔야 한다.

이 문서는 구현 전 계획이며 아직 승인된 구현으로 간주하지 않는다.

### Selected Model / Effort

- Registry recommendation: `PLAN: Sol XHigh`, `IMPLEMENT: Sol High`, `REVIEW: Sol High`
- Actual planning model: `GPT-5`
- Actual reasoning effort: 현재 실행 환경에서 노출되지 않아 확인할 수 없음

### Confirmed Cause

- `src/server/http/api-response.ts:99`는 unexpected error를 `logger.error(error, ...)`로 원본 그대로
  전달한다. 공개 HTTP body는 generic 500이라 안전하지만 관측 payload는 안전하지 않다.
- `src/shared/lib/sentry.ts:16-33`은 개발 환경에서 원본 error/context를 `console.error`로 출력하고,
  staging/production에서는 원본 `Error`와 임의의 `Record<string, unknown>` extras를
  `Sentry.captureException`에 전달한다. `warn`, `info`, breadcrumb도 임의 message/context를
  전달할 수 있다.
- `src/instrumentation.ts:17-21`은 shared logger를 거치지 않고 원본 error, Request, Next context를
  `Sentry.captureRequestError`에 전달한다. Request headers 및 URL 전체가 최종 capture에 포함될 수
  있는 별도 우회 경로다.
- `src/auth.ts`는 Auth.js custom logger를 설정하지 않는다. 설치된 Auth.js 0.41.3의 기본 logger는
  `AuthError.cause.err.stack`과 cause details를 console에 기록하며, credentials DB 오류가
  `CallbackRouteError` cause에 감싸지면 원본 Drizzle message가 노출될 수 있다.
- `sentry.server.config.ts`에는 `sendDefaultPii: false`나 `beforeSend` allowlist가 명시되어 있지 않다.
  SDK 기본값만으로 application이 직접 전달한 raw exception/message/extras를 제거할 수 없다.
- `src/server/http/api-response.ts:55-56`의 output-contract failure는 고정 message를 사용하지만 raw
  `ZodError`를 cause로 보존한다. 이 오류도 현재 raw capture 경로를 타므로 contract violation이라는
  관측 신호를 유지하면서 cause의 input/detail은 버려야 한다.
- `src/features/manage-album/api/upload-album-image-action.ts:40-41`도 server action에서 shared logger로
  원본 storage error를 전달한다. DATA-004 구현 시 현재의 모든 server-side raw logger caller를
  제거해야 하며, 이 파일의 authorization 문제는 DATA-002 범위로 남긴다.
- `.local/M7-POSTGRES-VERIFICATION.md`의 실제 PostgreSQL 17 검증에서 credential duplicate로 발생한
  Drizzle 오류가 SQL/params를 포함했고, synthetic email/password hash가 `logger.error`에 그대로
  전달되는 것이 재현되었다. 외부 Sentry 전송은 spy로 막았으므로 실제 Sentry 저장/노출 여부는
  확인되지 않았다.

Root cause는 민감한 key 몇 개의 redaction 누락이 아니다. 관측 API가 신뢰할 수 없는
`Error.message`, `stack`, `cause`, Request, 임의 context를 기본적으로 직렬화하는 denylist 구조인 것이
원인이다.

### Invariant to Preserve

- unexpected server exception과 output-contract violation은 계속 structured server log 및 Sentry
  대상이어야 한다.
- expected `AppError`, request validation failure, 정상적인 Auth.js credentials 거부는 Sentry에
  capture하지 않는다.
- 외부 HTTP 오류 계약은 유지한다. unexpected/output failure는
  `{ code: "INTERNAL_SERVER_ERROR", message: "서버 오류가 발생했습니다." }`와 500을 반환하고,
  Auth.js sign-in protocol은 application API error protocol로 바꾸지 않는다.
- console, structured logger, Sentry 어느 payload에도 SQL text, query params, raw message/stack/cause,
  password, hash, OTP, token, cookie, session, authorization header, private PII, full DB row를 넣지 않는다.
- 관측 payload에는 정해진 `event`, `source`, 안전한 error type, 검증된 safe code, level/timestamp,
  안전한 route/runtime metadata와 기존 trace/event correlation ID만 허용한다.
- 원본 error는 분류 함수의 입력으로만 사용할 수 있으며, 최종 log/capture payload의 어느 위치에도
  참조로 남기지 않는다.
- 기존 RSC/Service/Repository, Auth.js, Route Handler와 Sentry 경계를 재설계하지 않는다.

### Options

1. 기존 logger에서 `password`, `token` 같은 key만 재귀 redaction한다.
   - message, stack, cause 문자열 안의 SQL/params와 이름이 다른 민감 field를 놓치므로 기각한다.
2. `sentry.server.config.ts`의 `beforeSend`만으로 제거한다.
   - 개발 console, structured logger, Auth.js 기본 logger에는 적용되지 않고 raw error를 SDK에 넘기는
     구조도 유지되므로 단독안으로는 부족하다.
3. 모든 unexpected capture를 제거한다.
   - output-contract failure와 운영 장애 관측 불변성을 깨므로 기각한다.
4. 서버 전용 allowlist logger를 만들고 모든 server-side caller를 전환하며, Sentry `beforeSend`에서
   최종 event를 한 번 더 allowlist한다.
   - raw error가 console/Sentry로 넘어가기 전에 차단하고 SDK 보강/우회에도 방어선을 둘 수 있다.
     현재 architecture에 맞는 최소안으로 선택한다.

### Recommended Minimal Change

1. `src/server/observability/`에 `server-only` 관측 모듈을 추가한다.
   - caller는 raw `unknown` error와 좁은 typed context만 전달한다.
   - 모듈은 원본 message/stack/cause/context를 복사하거나 문자열화하지 않는다.
   - error type은 명시적으로 아는 범주(`database`, `output-contract`, `auth`, `unknown`)로 정규화한다.
   - code는 명시적 allowlist 또는 엄격히 검증된 고정 형식만 허용한다. PostgreSQL SQLSTATE를 보존할
     필요가 있으면 알려진 wrapper의 제한된 깊이에서 5자리 code만 읽고 cause 자체는 버린다.
   - `event`와 `source`는 자유 문자열/임의 extras 대신 유한한 typed vocabulary를 사용한다.
   - console에는 timestamp/level/event/source/error type/safe code와 안전한 context만 가진 structured
     payload를 출력한다. staging/production Sentry에는 같은 정보로 새로 만든 sanitized exception 또는
     고정 message만 전달한다.
2. `sentry.server.config.ts`에 `sendDefaultPii: false`를 명시하고 fail-closed `beforeSend`를 연결한다.
   - exception value/message는 고정된 안전 문구와 분류로 재구성한다.
   - stack frame은 파일/함수/line 같은 위치 정보만 보존하고 local variables/mechanism data는 버린다.
   - tags/extras/context는 `event`, `source`, 검증된 safe code, route/runtime 종류, Sentry trace/event ID만
     통과시킨다.
   - request URL/query/body/headers/cookies, user, arbitrary extras, breadcrumb data, raw cause는 버린다.
   - key-name denylist를 안전성의 근거로 사용하지 않는다.
3. HTTP mapper를 서버 logger로 전환한다.
   - request validation과 `AppError`는 기존처럼 capture하지 않는다.
   - unknown error는 `api.unexpected_error`로 capture하고 generic 500 body를 유지한다.
   - output validation error는 전용 내부 type 또는 명시적 safe code로 구분해
     `api.output_contract_violation`을 보존하되 Zod cause/input은 폐기한다.
4. `onRequestError`가 raw `captureRequestError`를 직접 호출하지 않게 하고 서버 logger를 사용한다.
   - Request 객체 전체는 넘기지 않는다. method와 검증된 Next `routerKind`/`routeType` 같은 고정 metadata만
     전달하며 실제 path/query/header는 제외한다.
   - 활성 Sentry scope의 검증된 trace/event ID가 있으면 보존한다. 현재 존재하지 않는 application
     request ID 체계는 이 finding에서 새로 만들지 않는다.
5. Auth.js `logger.error`를 명시적으로 설정한다.
   - `CredentialsSignin` 같은 정상 credentials 거부는 capture하지 않는다.
   - unexpected Auth.js failure는 safe Auth error type/code와 `auth.failure` event만 서버 logger에 넘기고
     wrapper cause/message/stack은 전송하지 않는다.
   - sign-in 응답/redirect/session 계약은 변경하지 않는다. debug logging은 활성화하지 않는다.
6. 현재 server-side shared logger caller인 album image upload action도 서버 logger로 전환한다.
   이 변경은 error reporting 호출만 다루며 upload authorization, validation, storage 구조는 DATA-002에
   남긴다.
7. `src/shared/lib/sentry.ts`는 client 관측 adapter임을 코드 경계로 명확히 하여 이후 서버 코드가
   다시 import하지 못하게 한다. client Sentry/replay의 별도 개인정보 정책 재설계는 이 finding에서
   수행하지 않는다.

새 logging dependency, generic error framework, generic redaction framework는 추가하지 않는다.

### Files Expected to Change

Expected:

- `src/server/observability/server-logger.ts` (new; 이름은 같은 책임을 드러내는 범위에서 조정 가능)
- `src/server/observability/server-logger.test.ts` (new)
- `src/server/http/api-response.ts`
- `src/server/http/api-response.test.ts`
- `src/instrumentation.ts`
- `src/instrumentation.test.ts` (new)
- `src/auth.ts`
- Auth.js logger 계약을 검증하는 focused test 1개(new; `src/auth.test.ts` 또는 server observability 인접 test)
- `sentry.server.config.ts`
- `src/shared/lib/sentry.ts` (client-only boundary 명시)
- `src/features/manage-album/api/upload-album-image-action.ts`
- upload action의 safe reporter 연결을 검증하는 focused test 1개(new, 필요 시)
- `docs/migration/m7-foundation-fixes/DATA-004.md`의 IMPLEMENTATION/VERIFICATION 기록

Excluded:

- DB schema, `drizzle/` migration SQL/meta, repositories, credentials/challenge 저장 데이터
- 공개 API DTO와 status code, Auth.js provider/session/redirect 계약
- DATA-002의 album upload authorization/storage 재배치
- DATA-003의 unique-conflict-to-`AppError` 매핑
- client Sentry replay/analytics 정책과 `sentry.client.config.ts`의 광범위한 재설계
- 새 request ID/distributed tracing 체계, 새 logging package, 운영 Sentry/production credential 접근
- architecture constitution, active architecture 문서, Domain Specification 변경

### Tests Required

- server logger unit test에 서로 다른 synthetic marker를 raw Error message, multi-line stack, nested cause,
  `params`, email, password hash, OTP hash, token, cookie, authorization, 임의 context에 넣는다.
- development console spy의 모든 argument를 직렬화한 결과와 structured payload 전체에 marker가 없고,
  timestamp/level/event/source/safe error type/code는 남는지 확인한다.
- staging/production Sentry mock에서 `captureException`과 사용하는 경우 `captureMessage`, scope tags/extras,
  최종 `beforeSend` 결과 전체에 marker가 없고 event/source/type/code/trace ID는 남는지 확인한다.
- 직접 만든 Error가 아닌 string/object/primitive와 getter가 throw하는 hostile input도 logger 자체를
  실패시키거나 원본을 출력하지 않는지 확인한다.
- API test에서 request `ZodError`와 `AppError`는 capture하지 않고, unexpected error 및 실제
  `jsonResponse` output-contract failure는 각각 올바른 safe event로 1회 capture하면서 기존 500 body를
  유지하는지 확인한다.
- instrumentation test에서 marker를 error/cause, URL query, cookie/authorization header, unknown context에
  넣고 raw `captureRequestError`가 호출되지 않으며 safe route/runtime metadata만 전달되는지 확인한다.
- Auth.js logger test에서 정상 `CredentialsSignin`은 capture하지 않고, marker가 든 nested DB cause를
  가진 unexpected auth failure는 safe Auth type/event만 기록하는지 확인한다.
- upload action test를 추가하는 경우 storage rejection의 raw message/cause가 reporter 출력에 남지 않고
  기존 사용자용 실패 결과는 유지되는지 확인한다.
- focused tests 후 repository gate를 실행한다:

```bash
pnpm type-check
pnpm test:harness
pnpm lint
pnpm lint:fsd
pnpm test:unit:run
pnpm format:check
pnpm build
```

### Actual PostgreSQL Verification

기존 PostgreSQL 17 기록은 취약점 재현 근거이며 수정 완료 증거가 아니다. IMPLEMENT에서 Docker Compose의
로컬 PostgreSQL만 사용해 다음을 다시 검증한다.

1. 임시 database를 만들고 `scripts/assert-local-database.ts` guard를 통과한 URL에 0000~현재 migration을
   명시적으로 적용한다.
2. synthetic email/password hash가 query params에 포함되는 실제 credential unique violation을 발생시켜
   Drizzle wrapper error를 얻는다. 필요하면 challenge 실패로 OTP hash와 유효한 test IP도 확인하되 실제
   credential/OTP 값은 사용하지 않는다.
3. 그 오류를 실제 server logger 및 HTTP error mapper에 전달한다. 외부 Sentry transport는 mock/spied
   capture로 막는다.
4. console structured payload, `captureException`/`captureMessage` argument, scope metadata,
   `beforeSend` 반환 event, HTTP body를 모두 직렬화해 모든 marker/SQL/params가 없음을 assert한다.
5. safe event/source/error type/검증된 SQLSTATE와 generic 500 response는 유지되는지 확인한다.
6. 임시 database의 연결 수가 0인지 확인한 뒤 명시적으로 drop하고 실제 명령과 결과를 VERIFICATION에
   기록한다. 기존 local database는 변경하지 않고 production credential은 사용하지 않는다.

### Risks / Unknowns

- 실제 Sentry 조직의 저장, Relay scrubbing, retention, 접근 권한은 확인되지 않았다. 이 계획은
  application이 내보내는 payload를 통제하며 운영 Sentry 설정을 검증했다고 주장하지 않는다.
- fail-closed allowlist는 원본 stack/message를 제거하므로 진단 세부 정보가 줄어든다. 이를 보완하기 위해
  stable event/source/type/code와 안전한 stack frame 위치, trace/event correlation을 보존한다.
- Next/Sentry가 capture 이후 event에 request 정보를 보강할 수 있으므로 server `beforeSend` 검증이
  필수다. SDK에서 allowlist를 보장할 수 없는 새로운 자동 capture 경로가 확인되면 구현을 중단하고
  해당 integration의 비활성화 또는 별도 정책 결정을 요청한다.
- Auth.js error type은 안전한 고정 vocabulary로 검증해야 한다. custom logger가 로그인 결과나 redirect
  semantics를 바꾸거나 예상 실패와 unexpected failure를 구분할 수 없다면 구현을 중단하고 분류 정책을
  요청한다.
- application request ID는 현재 없다. correlation 요구를 충족하기 위해 새 ID 발급/전파가 필요해지면
  HTTP response/header 계약까지 확대하기 전에 별도 결정을 요청한다.
- DATA-002가 먼저 upload action을 이동하거나 DATA-003이 먼저 DB 오류를 AppError로 변환하면 현재
  caller/file scope를 재확인한다. DATA-004의 safe boundary 불변성과 충돌하는 경우 계획을 갱신하기 전
  구현하지 않는다.
- 민감 값이 필요한 운영 디버깅, raw error 보존, client replay/analytics 변경, 새 dependency 또는 계획에
  없는 파일 대량 변경이 필요하면 `ESCALATION`으로 중단한다.

현재 evidence에는 구현 전 사용자 정책 결정이 필요한 escalation이 없다.

### Implementation Prompt

`M7-DATA-004`를 이 계획의 allowlist option으로 구현한다. 승인할 불변성은 unexpected server exception과
output-contract failure의 관측 및 기존 HTTP/Auth.js 계약을 유지하면서, 원본 error/message/stack/cause,
SQL/params와 인증정보·hash·OTP·token·cookie·session·authorization·private PII를 console/structured
logger/Sentry 어디에도 전달하지 않는 것이다.

허용 범위는 `src/server/observability/`의 좁은 server-only logger와 tests,
`src/server/http/api-response.ts` 및 test, `src/instrumentation.ts` 및 test, `src/auth.ts` 및 focused test,
`sentry.server.config.ts`, shared Sentry adapter의 client-only 경계, 현재 upload action의 logger 연결,
그리고 이 문서의 IMPLEMENTATION/VERIFICATION 갱신이다. DB schema/migration/repository, API/Auth.js 계약,
DATA-002 authorization, DATA-003 conflict mapping, client replay 정책, 새 request ID/trace framework와 새
logging dependency는 변경하지 않는다.

typed event/source와 fail-closed safe error descriptor를 만들고, server Sentry `beforeSend`에서 최종 event를
다시 allowlist한다. API unexpected/output failure, Next instrumentation, Auth.js unexpected failure, upload
failure를 이 경계로 연결한다. expected AppError/request validation/CredentialsSignin은 capture하지 않는다.
원본 error는 분류 입력으로만 사용하고 최종 payload에 참조하지 않는다.

위 focused synthetic-marker tests와 repository gate 전부를 실행한다. 이후 격리된 Docker Compose
PostgreSQL 17 임시 DB에서 실제 credential unique 오류를 만들고 logger/HTTP/Sentry mock/final event 어디에도
marker와 SQL/params가 남지 않으며 safe event/source/type/code와 500 응답은 유지되는지 검증한다. 기존 DB와
production credential은 사용하지 않는다.

현재 source가 이 baseline과 달라졌거나, SDK/Auth.js 우회 경로를 allowlist로 막을 수 없거나, raw 진단값,
새 정책·dependency·contract·architecture 변경 또는 허용 범위 밖 파일이 필요하면 구현하지 말고
`ESCALATION`으로 충돌 근거와 필요한 결정을 보고한다.

## IMPLEMENTATION

### Changed Files

- `src/server/observability/safe-server-event.ts` (new)
- `src/server/observability/server-logger.ts` (new)
- `src/server/observability/auth-error-reporter.ts` (new)
- `src/server/observability/server-logger.test.ts` (new)
- `src/server/observability/auth-error-reporter.test.ts` (new)
- `src/server/http/api-response.ts`
- `src/server/http/api-response.test.ts`
- `src/instrumentation.ts`
- `src/instrumentation.test.ts` (new)
- `src/auth.ts`
- `sentry.server.config.ts`
- `src/features/manage-album/api/upload-album-image-action.ts`
- `docs/migration/m7-foundation-fixes/DATA-004.md`

### Implemented Decision

- Registry recommendation은 `IMPLEMENT: Sol High`다. 실제 implementation model은 `GPT-5`이며
  reasoning effort는 실행 환경에서 노출되지 않아 확인할 수 없다.
- `server-only` logger는 raw error를 분류 입력으로만 받고 structured console payload와 Sentry에는
  timestamp/level, finite event/source, safe error type, 검증된 code, allowlisted Next request metadata만
  전달한다.
- PostgreSQL code는 실제 `DrizzleQueryError`의 바로 아래 cause에서만 읽고 5자리 SQLSTATE 형식만
  보존한다. arbitrary Error의 `message`, `stack`, `cause`, `params`는 직렬화하지 않는다.
- Sentry server init은 `sendDefaultPii: false`와 fail-closed `beforeSend`를 사용한다. 최종 event는
  event ID, level/environment, safe exception type/value, allowlisted tags, 검증된 trace/span ID만 남기고
  request/user/extra/breadcrumb/raw exception/message/logentry를 제거한다.
- HTTP mapper는 expected `AppError`와 request `ZodError`를 capture하지 않는다. unexpected error는
  `api.unexpected_error`, output-contract failure는 raw Zod cause 없이
  `api.output_contract_violation`/`OUTPUT_CONTRACT_VIOLATION`으로 구분하며 기존 generic 500 body를 유지한다.
- Next instrumentation은 raw `captureRequestError`를 제거하고 method/router kind/route type만 safe logger에
  전달한다. path/query/header/cookie와 unknown context는 전달하지 않는다.
- Auth.js custom logger는 stable `CredentialsSignin` type의 정상 credentials 거부를 capture하지 않고,
  unexpected wrapper failure만 `auth.failure`/`AUTH_FAILURE`로 기록한다. Auth.js response/session 계약은
  바꾸지 않았다.
- album image upload action은 storage error 원본을 버리고 고정된 `AlbumImageUploadError`만 기존 shared
  adapter에 전달한다. server `beforeSend`는 이 고정 type을 `upload.failure` 및
  `upload-album-image-action`으로 정규화한다.

### Plan Deviations

- `features`에서 `src/server` 직접 import는 현재 ESLint FSD rule이 금지한다. 따라서 upload action을
  server logger로 직접 전환하거나 shared Sentry adapter에 `client-only` marker를 추가하지 않았다.
  대신 원본 storage error를 action에서 즉시 폐기하고 고정 safe Error를 전달하며, server
  `beforeSend`가 고정 type을 allowlist event/source로 바꾼다. upload action의 이동과 authorization은
  계획대로 DATA-002에 남겼다.
- 최종 Sentry allowlist는 안전한 stack frame 위치도 보존하지 않는다. file/function 이름까지 raw event에서
  복사하지 않는 fail-closed 처리를 선택했으며, 계획의 필수 불변성인 event/source/type/code와 검증된
  trace/event correlation은 유지한다.
- 별도 upload action test는 추가하지 않았다. action이 raw caught value를 사용하지 않는 것은 정적 diff로
  확인했고, 고정 `AlbumImageUploadError`의 최종 event/source 및 storage detail 제거는 server Sentry
  sanitizer unit test로 검증했다.

### Tests Added or Changed

- `server-logger.test.ts`: 실제 `DrizzleQueryError` shape, nested markers, structured console,
  staging Sentry capture, hostile Proxy/getter, primitive input, runtime type bypass, final event allowlist,
  `captureMessage` fallback, upload 고정 type, `beforeSend` 등록을 검증한다.
- `auth-error-reporter.test.ts`: `CredentialsSignin` 미capture와 nested DB cause가 있는 unexpected Auth.js
  failure의 safe classification을 검증한다.
- `instrumentation.test.ts`: URL/query/cookie/authorization/context marker를 제외하고 method/router/route
  metadata만 전달하며 development capture를 생략하는지 검증한다.
- `api-response.test.ts`: expected failure 미capture, unexpected/output-contract safe event, 기존 500 body,
  invalid output marker 폐기를 검증한다.
- 최종 focused 결과: 4 files, 20 tests passed.

### Implementation Failures and Corrections

- 첫 focused run에서 test가 `next-auth` root를 직접 import하여 Vitest ESM 환경의 `next/server` resolution
  오류로 시작하지 못했다. production code가 Auth.js logger에서 받는 stable `error.type`을 검사하도록
  바꾸고 test fixture도 package runtime import 없이 같은 contract를 사용했다.
- 같은 첫 점검의 type-check에서 Sentry malicious fixture와 AuthError constructor type 오류가 있었다.
  fixture를 의도적인 `unknown as ErrorEvent`로 한정하고 Auth fixture를 실제 logger input shape로 바꿨다.
- focused ESLint의 relative import 정렬 오류 1건을 수정했다. 이후 focused tests/type-check/lint와 모든
  repository gate가 통과했다.

## VERIFICATION

### Commands Run and Results

- `pnpm exec vitest run src/server/observability/server-logger.test.ts src/server/observability/auth-error-reporter.test.ts src/server/http/api-response.test.ts src/instrumentation.test.ts`
  - 최종: 4 files, 20 tests passed.
- `pnpm type-check`
  - 통과.
- `pnpm test:harness`
  - 7 tests passed.
- `pnpm lint`
  - 통과.
- `pnpm lint:fsd`
  - 통과, `No problems found`.
- `pnpm test:unit:run`
  - 37 files, 128 tests passed.
- `pnpm format:check`
  - 통과.
- `pnpm build`
  - Next.js 16.3.3 production build, TypeScript, 23개 static page generation 통과.
- `rg`로 production source의 raw server capture를 재검색했다.
  - API와 instrumentation의 raw 전달은 제거됐다. 남은 `logger.error(error, context)`는 client error
    capture 경로이고, upload server action은 caught raw error를 사용하지 않는다.

### Actual PostgreSQL Evidence

- 대상: `compose.dev.yml`의 local PostgreSQL 17, 임시 database
  `m7_data_004_20260906_0423`.
- 임시 DB 생성 후 다음 URL로 local guard를 실행해 `127.0.0.1` 통과를 확인했다.
  `M7_DATA_004_DATABASE_URL`과 `DATABASE_URL`은 임시 DB만 가리켰다.
- `node node_modules/vitest/vitest.mjs run --config .local/m7-data-004-verification.config.ts --reporter=verbose`
  - 현재 Drizzle migration을 임시 DB에 적용했다.
  - 두 Account를 만들고 같은 synthetic email/password hash로 credential insert를 실행해 실제
    `DrizzleQueryError` 및 `23505`를 얻었다.
  - raw outer message에 synthetic email/password hash가 포함된 것을 먼저 assert하여 재현 근거를
    유지했다.
  - 실제 `toErrorResponse`/server logger와 mocked external Sentry capture를 통과시킨 뒤 structured console,
    `captureException`, scope tags, final `beforeSend` event, HTTP body 전체에 email/hash/cookie/token marker,
    credential INSERT SQL, `params:`가 없음을 assert했다.
  - `api.unexpected_error`, `api-route-handler`, `database`, `23505`, generic 500 body와 검증된 trace/span ID는
    유지됐다.
  - 1 file, 1 test passed.
- 종료 후 `pg_stat_activity`의 임시 DB connection이 0임을 확인하고 `DROP DATABASE`를 실행했다.
  catalog 재조회 결과 database count는 0이었다. 기존 local application DB와 production DB는 변경하지
  않았다.

### Remaining Unknowns

- 실제 Sentry 조직의 수신 payload, Relay 추가 scrubbing, retention과 접근 권한은 확인하지 않았다.
  외부 전송은 의도적으로 mock했다.
- client Sentry/replay의 별도 개인정보 정책은 DATA-004 범위 밖이며 변경하지 않았다.
- application request ID는 아직 없다. 현재는 Sentry의 검증된 event/trace/span correlation만 보존한다.
- upload action은 DATA-002에서 authorization과 server/storage 경계를 함께 이동해야 한다. 현재 DATA-004는
  그 전까지 raw storage error가 관측 payload로 나가지 않는 것만 보장한다.
- REVIEW는 아직 수행하지 않았다.

## REVIEW

### Verdict

REWORK

### Findings by Severity

#### High — 최종 Sentry event가 안전한 stack frame 위치까지 제거한다

`src/server/observability/safe-server-event.ts:189-215`는 exception을 고정 type/value만으로 다시 만들고
`stacktrace.frames`를 전혀 보존하지 않는다. `src/server/observability/server-logger.ts:61-75`에서 새로 만든
sanitized Error의 안전한 호출 stack도 같은 `beforeSend` 경계를 지나며 제거된다. 그 결과 서로 다른 코드
위치에서 발생한 동일 분류의 장애는 event/source/type/code 외에 원인을 구분하거나 호출 위치를 찾을 정보가
없다. 자동 capture된 unhandled error도 모두 같은 `server.unhandled_error`/`UnknownError` 형태로 축약된다.

이는 승인된 PLAN의 `DATA-004.md:102` 및 `DATA-004.md:212-213`에 명시된 안전한 file/function/line 위치
보존과, unexpected server exception의 관측 가능성을 유지한다는 불변성을 충족하지 못한다. 최종 event에는
raw message/cause와 frame의 vars, context line, mechanism data를 넣지 않으면서, sanitized Error 또는 입력
event에서 허용한 frame의 filename/function/line/column만 새 객체로 재구성해야 한다.
서로 다른 두 caller가 최종 event에서 안전한 위치 정보로 구분되고 synthetic marker는 남지 않는 test도
필요하다.

#### Low — server logger의 stdout 출력이 structured JSON이 아니다

`src/server/observability/server-logger.ts:50-57`은 allowlisted payload 객체를 `console.error`에 직접
전달한다. Node.js stdout/stderr에서는 이 값이 여러 줄의 `util.inspect` 형식으로 출력되므로 active
architecture의 structured JSON 및 Docker/stdout 친화성 기준을 충족하지 않는다.
`src/server/observability/server-logger.test.ts:65-69`는 mock call을 사후 `JSON.stringify`하여 검사하기
때문에 실제 출력 형식의 회귀를 잡지 못한다. logger가 한 줄 JSON 문자열을 출력하고 test가 유일한 console
argument를 parse하여 schema와 marker 부재를 확인하도록 보완해야 한다.

### Blocking Issues

- 안전한 stack frame 위치를 final Sentry event에 복원하고, 민감 frame field를 제거한 상태에서 서로 다른
  caller의 진단 가능성을 검증해야 한다.

### Minor Issues

- server stdout을 실제 structured JSON으로 출력하고 해당 wire format을 직접 검증해야 한다.

### Remaining Risks

- 실제 Sentry 조직의 수신 payload와 grouping은 production credential을 사용하지 않아 확인하지 않았다.
  재작업에서는 mocked `beforeSend` 최종 event를 기준으로 허용 frame field와 marker 부재를 검증해야 한다.
- album upload action은 FSD 경계 때문에 아직 shared Sentry adapter를 사용하는 계획 이탈 상태다. 현재는
  caught storage error를 버리고 고정 Error만 전달하여 raw detail 유출은 차단하지만, DATA-002에서 action의
  server/storage 경계를 이동할 때 server-only logger로 전환해야 한다.
- PostgreSQL 17 임시 DB 검증은 실제 `DrizzleQueryError`의 SQL/params와 credential marker가 console,
  capture argument, final event, HTTP body에 남지 않는 것을 충분히 입증했다. stack frame 및 stdout 수정 후
  같은 검증을 다시 실행해야 한다.

### Reviewer Recommendation

안전한 stack frame allowlist와 한 줄 structured JSON 출력을 구현하고 focused marker tests, repository gate,
isolated PostgreSQL 17 검증을 다시 실행한다. IMPLEMENTATION/VERIFICATION evidence를 추가한 뒤
`/m7-review DATA-004`를 재실행한다. REVIEW registry recommendation은 `Sol / High`이며, 실제 review 세션의
reasoning effort는 노출되지 않아 추정하지 않았다.
