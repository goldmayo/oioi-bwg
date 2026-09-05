# M7-DATA-004

## Status

PLANNED

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

pending

## VERIFICATION

pending

## REVIEW

pending
